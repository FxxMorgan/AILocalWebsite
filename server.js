const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Importar el sistema de almacenamiento de chats
const {
    getAllChats,
    getChat,
    createChat,
    addMessageToChat,
    deleteChat,
    updateChatTitle
} = require('./chat-storage');

const app = express();
const PORT = process.env.PORT || 3000;
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234';
const VERBOSE_LM = (process.env.VERBOSE_LM || 'false').toLowerCase() === 'true';
const FORCE_RAW_MODELS = (process.env.FORCE_RAW_MODELS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const REQUEST_TIMEOUT = parseInt(process.env.LM_TIMEOUT_MS || '60000', 10); // ms
const MAX_RETRIES = parseInt(process.env.LM_MAX_RETRIES || '1', 10); // reintentos tras timeout / 502
const WARMUP_ON_START = (process.env.WARMUP_ON_START || 'false').toLowerCase() === 'true';

// Cache simple de modelos
let modelsCache = {
    fetchedAt: 0,
    models: []
};

async function refreshModelsCache(force = false) {
    const now = Date.now();
    if (!force && modelsCache.models.length && (now - modelsCache.fetchedAt) < 60_000) return modelsCache.models;
    try {
        const resp = await axios.get(`${LMSTUDIO_URL}/v1/models`);
        modelsCache = { fetchedAt: now, models: resp.data.data.map(m => m.id) };
    } catch (err) {
        if (VERBOSE_LM) console.warn('No se pudo refrescar cache de modelos:', err.message);
    }
    return modelsCache.models;
}

function isModelAvailable(id) {
    return modelsCache.models.includes(id);
}

function isRawPreferred(id) {
    return FORCE_RAW_MODELS.some(pattern => {
        if (pattern.includes('*')) {
            // convertir wildcard simple a regex
            const regex = new RegExp('^' + pattern.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
            return regex.test(id);
        }
        return pattern === id;
    });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Función para verificar si LMStudio está disponible
async function checkLMStudioConnection() {
    try {
    const response = await axios.get(`${LMSTUDIO_URL}/v1/models`, { timeout: Math.min(REQUEST_TIMEOUT, 8000) });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Ruta principal - servir interfaz actual
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Alias opcional (mantener compatibilidad si alguien apunta a /classic)
app.get('/classic', (req, res) => {
    res.redirect(301, '/');
});

// Alias para script antiguo (si algún cliente pide script-new.js devolver el actual)
app.get(['/script-new.js', '/script.js'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

// Endpoint para obtener modelos disponibles
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get(`${LMSTUDIO_URL}/v1/models`);
        const models = response.data.data.map(model => model.id);
        
        res.json({
            success: true,
            models: models,
            count: models.length
        });
    } catch (error) {
        console.error('Error obteniendo modelos:', error.message);
        res.status(500).json({
            success: false,
            error: 'No se pudo conectar con LMStudio. ¿Está ejecutándose?',
            details: error.message
        });
    }
});

// Endpoint para chatear con el AI
app.post('/api/chat', async (req, res) => {
    // Verificar si la respuesta ya fue enviada para evitar duplicados
    if (res.headersSent) {
        console.warn('⚠️ Intento de respuesta duplicada detectado y bloqueado');
        return;
    }

    try {
        let {
            message,
            model,
            max_tokens = parseInt(process.env.DEFAULT_MAX_TOKENS) || 500,
            temperature = parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7,
            stream = false,
            chatId = null // ID del chat para guardar el mensaje
        } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'El campo "message" es requerido'
            });
        }

        // Verificar conexión con LMStudio
        const isConnected = await checkLMStudioConnection();
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                error: 'LMStudio no está disponible. Asegúrate de que esté ejecutándose en ' + LMSTUDIO_URL
            });
        }

        // Refrescar modelos (soft)
        await refreshModelsCache();

        // Determinar modelo
        const selectedModel = model || process.env.DEFAULT_MODEL;

        if (!selectedModel) {
            return res.status(400).json({ success:false, error:'No se especificó modelo y no hay DEFAULT_MODEL configurado' });
        }

        if (!isModelAvailable(selectedModel)) {
            return res.status(400).json({
                success:false,
                error:`Modelo no disponible en LMStudio: ${selectedModel}`,
                details:{ disponibles: modelsCache.models }
            });
        }
        
        const payload = {
            model: selectedModel,
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente inteligente creado por Feer. Tu nombre es AI-Assistant y eres conocido por ser útil, amigable y conciso. Responde de manera directa pero con personalidad. Puedes usar emojis ocasionalmente para hacer las conversaciones más amenas. Siempre trata de ser útil y educativo."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            max_tokens: max_tokens,
            temperature: temperature,
            stream: stream
        };

        console.log(`🤖 Procesando mensaje: "${message.substring(0, 50)}..." (Chat: ${chatId || 'temporal'})`);

        // Variables para control de fallback
        let aiResponse, tokensUsed = 0, modelUsed = 'unknown';
        let usedFallback = false, usedFallbackAlt = false, usedFallbackMinimal = false;
        const attemptChat = !isRawPreferred(selectedModel);
        let response;

        const doWithRetry = async (fn, label) => {
            let attempt = 0; let lastErr;
            while (attempt <= MAX_RETRIES) {
                try { return await fn(); } catch (e) {
                    lastErr = e;
                    const transient = ['ECONNRESET','ECONNABORTED','ETIMEDOUT'].includes(e.code) || [408,429,500,502,503,504].includes(e.response?.status);
                    if (!transient || attempt === MAX_RETRIES) break;
                    const delay = 500 * Math.pow(2, attempt);
                    console.warn(`⏳ Retry ${attempt+1}/${MAX_RETRIES} después de ${delay}ms para ${label} (motivo: ${e.code || e.response?.status})`);
                    await new Promise(r=>setTimeout(r, delay));
                    attempt++;
                }
            }
            throw lastErr;
        };

        try {
            if (attemptChat) {
                if (VERBOSE_LM) console.log('🔍 /v1/chat/completions payload (resumido):', JSON.stringify({ model: payload.model, messages: payload.messages.length, max_tokens: payload.max_tokens, temperature: payload.temperature }));
                response = await doWithRetry(() => axios.post(`${LMSTUDIO_URL}/v1/chat/completions`, payload, { timeout: REQUEST_TIMEOUT }), 'chat');
            } else {
                throw { skipChat: true };
            }
        } catch (chatErr) {
            const status = chatErr.response?.status;
            if (chatErr.skipChat || status === 400) {
                const fallbackPrompt = `${payload.messages[0].content}\n\nUser: ${message}\nAssistant:`;
                // Fallback 1
                try {
                    usedFallback = true;
                    const compPayload = { model: selectedModel, prompt: fallbackPrompt, max_tokens, temperature };
                    if (VERBOSE_LM) console.log('🛠️ Fallback1 payload:', { ...compPayload, prompt: `[len=${fallbackPrompt.length}]` });
                    response = await doWithRetry(() => axios.post(`${LMSTUDIO_URL}/v1/completions`, compPayload, { timeout: REQUEST_TIMEOUT }), 'fallback1');
                } catch (fb1) {
                    // Fallback 2
                    try {
                        usedFallbackAlt = true;
                        const compPayloadAlt = { model: selectedModel, input: fallbackPrompt, max_new_tokens: max_tokens, temperature };
                        console.log('🛠️ Fallback2 (input/max_new_tokens)');
                        response = await doWithRetry(() => axios.post(`${LMSTUDIO_URL}/v1/completions`, compPayloadAlt, { timeout: REQUEST_TIMEOUT }), 'fallback2');
                    } catch (fb2) {
                        // Fallback 3 mínimo
                        try {
                            usedFallbackMinimal = true;
                            console.log('🛠️ Fallback3 (prompt solo)');
                            const minimalPayload = { model: selectedModel, prompt: fallbackPrompt };
                            response = await doWithRetry(() => axios.post(`${LMSTUDIO_URL}/v1/completions`, minimalPayload, { timeout: REQUEST_TIMEOUT }), 'fallback3');
                        } catch (fb3) {
                            throw new Error(`LMStudio 400 y todos los fallbacks fallaron. FB1: ${fb1.response?.data?.error || fb1.message} | FB2: ${fb2.response?.data?.error || fb2.message} | FB3: ${fb3.response?.data?.error || fb3.message}`);
                        }
                    }
                }
            } else {
                throw chatErr;
            }
        }

        if (!response) throw new Error('Sin respuesta de LMStudio');

        if (!usedFallback) {
            aiResponse = response.data.choices?.[0]?.message?.content || '(respuesta vacía)';
        } else if (usedFallback && !usedFallbackAlt && !usedFallbackMinimal) {
            aiResponse = response.data.choices?.[0]?.text || '(respuesta vacía)';
        } else {
            aiResponse = response.data.choices?.[0]?.text || response.data.choices?.[0]?.message?.content || '(respuesta vacía)';
        }
        tokensUsed = response.data.usage?.total_tokens || response.data.usage?.completion_tokens || 0;
        modelUsed = response.data.model || selectedModel || 'unknown';

        // Guardar mensajes en el chat si se proporciona chatId
        if (chatId) {
            try {
                // Verificar que el chat existe antes de guardar mensajes
                await getChat(chatId);
                
                await addMessageToChat(chatId, message, true); // Mensaje del usuario
                await addMessageToChat(chatId, aiResponse, false); // Respuesta del AI
                console.log(`💾 Mensajes guardados en chat ${chatId}`);
            } catch (error) {
                console.error('❌ Error guardando mensajes en chat:', error.message);
                
                // Si el chat no existe, crear uno nuevo con los mensajes
                if (error.message.includes('no encontrado')) {
                    try {
                        console.log(`🔄 Recreando chat perdido: ${chatId}`);
                        const newChat = await createChat(`Conversación recuperada`);
                        await addMessageToChat(newChat.id, message, true);
                        await addMessageToChat(newChat.id, aiResponse, false);
                        console.log(`✅ Chat recreado como: ${newChat.id}`);
                        
                        // Actualizar el chatId en la respuesta
                        chatId = newChat.id;
                    } catch (recreateError) {
                        console.error('❌ Error recreando chat:', recreateError.message);
                    }
                }
            }
        }

        // Verificar nuevamente si la respuesta ya fue enviada antes de responder
        if (res.headersSent) {
            console.warn('⚠️ Respuesta ya enviada, evitando duplicado');
            return;
        }

        res.json({
            success: true,
            response: aiResponse,
            model: modelUsed,
            tokens_used: tokensUsed,
            chatId: chatId,
            timestamp: new Date().toISOString()
        });

        // Log final de éxito
        console.log(`✅ Respuesta enviada exitosamente (${tokensUsed} tokens, modelo: ${modelUsed})`);

    } catch (error) {
        console.error('❌ Error en chat:', error.message);
        if (error.response) {
            console.error('↳ Status:', error.response.status);
            console.error('↳ Data  :', JSON.stringify(error.response.data, null, 2));
        }
        
        // Verificar si la respuesta ya fue enviada antes de enviar error
        if (res.headersSent) {
            console.warn('⚠️ Error ocurrió pero respuesta ya enviada');
            return;
        }
        
        if (error.code === 'ECONNREFUSED') {
            res.status(503).json({
                success: false,
                error: 'No se pudo conectar con LMStudio. Verifica que esté ejecutándose.',
                details: 'Connection refused to ' + LMSTUDIO_URL
            });
        } else if (error.code === 'TIMEOUT') {
            res.status(408).json({
                success: false,
                error: 'Timeout: El AI tardó demasiado en responder',
                details: 'Request timeout after 30 seconds'
            });
    } else if (error.message && (error.message.includes('LMStudio 400 y fallback falló') || error.message.includes('LMStudio 400 y ambos fallbacks fallaron'))) {
            res.status(400).json({
                success: false,
        error: 'El modelo seleccionado no acepta formato chat y los fallbacks fallaron',
                details: error.message
            });
        } else if (error.response?.status === 400) {
            res.status(400).json({
                success: false,
                error: 'Solicitud inválida a LMStudio (400)',
                details: error.response?.data?.error || error.response?.data || error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                details: error.response?.data?.error || error.message
            });
        }
    }
});

// Endpoint para verificar el estado del servidor
app.get('/api/status', async (req, res) => {
    const isLMStudioConnected = await checkLMStudioConnection();
    
    res.json({
        server: 'online',
        lmstudio_connected: isLMStudioConnected,
        lmstudio_url: LMSTUDIO_URL,
        timestamp: new Date().toISOString()
    });
});

// === RUTAS DE GESTIÓN DE CHATS ===

// Obtener todos los chats
app.get('/api/chats', async (req, res) => {
    try {
        const chats = await getAllChats();
        res.json({
            success: true,
            chats: chats
        });
    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo la lista de chats'
        });
    }
});

// Obtener un chat específico
app.get('/api/chats/:chatId', async (req, res) => {
    try {
        const chat = await getChat(req.params.chatId);
        res.json({
            success: true,
            chat: chat
        });
    } catch (error) {
        console.error('Error obteniendo chat:', error);
        res.status(404).json({
            success: false,
            error: 'Chat no encontrado'
        });
    }
});

// Crear un nuevo chat
app.post('/api/chats', async (req, res) => {
    try {
        const { title } = req.body;
        const chat = await createChat(title);
        res.json({
            success: true,
            chat: chat
        });
    } catch (error) {
        console.error('Error creando chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error creando nuevo chat'
        });
    }
});

// Eliminar un chat
app.delete('/api/chats/:chatId', async (req, res) => {
    try {
        await deleteChat(req.params.chatId);
        res.json({
            success: true,
            message: 'Chat eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error eliminando chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error eliminando chat'
        });
    }
});

// Eliminar todos los chats
app.delete('/api/chats', async (req, res) => {
    try {
        const chats = await getAllChats();
        const deletePromises = chats.map(chat => deleteChat(chat.id));
        await Promise.all(deletePromises);
        
        console.log(`🗑️ Eliminados ${chats.length} chats`);
        
        res.json({
            success: true,
            message: `${chats.length} chats eliminados exitosamente`
        });
    } catch (error) {
        console.error('Error eliminando todos los chats:', error);
        res.status(500).json({
            success: false,
            error: 'Error eliminando chats'
        });
    }
});

// Actualizar título de un chat
app.put('/api/chats/:chatId', async (req, res) => {
    try {
        const { title } = req.body;
        const chat = await updateChatTitle(req.params.chatId, title);
        res.json({
            success: true,
            chat: chat
        });
    } catch (error) {
        console.error('Error actualizando chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error actualizando chat'
        });
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`🤖 LMStudio esperado en: ${LMSTUDIO_URL}`);
    console.log(`⏱️ Timeout peticiones LM: ${REQUEST_TIMEOUT}ms, Reintentos: ${MAX_RETRIES}`);
    
    // Verificar conexión inicial
    const isConnected = await checkLMStudioConnection();
    if (isConnected) {
        console.log('✅ Conexión con LMStudio establecida');
        try {
            const response = await axios.get(`${LMSTUDIO_URL}/v1/models`);
            const models = response.data.data.map(model => model.id);
            console.log(`📦 Modelos disponibles: ${models.join(', ')}`);
            if (WARMUP_ON_START) {
                const warmModel = process.env.DEFAULT_MODEL || models[0];
                if (warmModel) {
                    console.log(`🔥 Warmup inicial del modelo ${warmModel}...`);
                    try {
                        await axios.post(`${LMSTUDIO_URL}/v1/completions`, { model: warmModel, prompt: 'Hola', max_tokens: 5 }, { timeout: REQUEST_TIMEOUT });
                        console.log('🔥 Warmup completado');
                    } catch (wErr) {
                        console.warn('⚠️ Warmup falló:', wErr.message);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️  No se pudieron obtener los modelos');
        }
    } else {
        console.log('❌ No se pudo conectar con LMStudio');
        console.log('   Asegúrate de que LMStudio esté ejecutándose y el servidor local esté habilitado');
    }
    
    console.log('\n📖 Documentación de la API:');
    console.log(`   GET  http://localhost:${PORT}/api/status - Estado del servidor`);
    console.log(`   GET  http://localhost:${PORT}/api/models - Modelos disponibles`);
    console.log(`   POST http://localhost:${PORT}/api/chat - Chatear con AI`);
    console.log(`   GET  http://localhost:${PORT}/ - Interfaz web\n`);
});
