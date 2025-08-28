const axios = require('axios');

// Función para probar la conexión con el servidor
async function testConnection() {
    console.log('🔍 Probando conexión con el servidor...\n');
    
    try {
        // Probar estado del servidor
        const statusResponse = await axios.get('http://localhost:3000/api/status');
        console.log('✅ Estado del servidor:', statusResponse.data);
        
        // Probar modelos disponibles
        try {
            const modelsResponse = await axios.get('http://localhost:3000/api/models');
            console.log('\n📦 Modelos disponibles:', modelsResponse.data);
            
            // Si el modelo preferido está disponible, hacer una pregunta de prueba
            if (modelsResponse.data.models && modelsResponse.data.models.includes('qwen/qwen3-4b-2507')) {
                console.log('\n🎯 Modelo qwen/qwen3-4b-2507 encontrado! Haciendo pregunta de prueba...');
                await testChat();
            } else {
                console.log('\n⚠️  Modelo qwen/qwen3-4b-2507 no encontrado en LMStudio');
                console.log('   Asegúrate de cargar este modelo en LMStudio');
            }
            
        } catch (error) {
            console.log('\n❌ Error obteniendo modelos:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.log('❌ Error conectando con el servidor:', error.message);
        console.log('   Asegúrate de que el servidor esté ejecutándose en http://localhost:3000');
    }
}

// Función para probar el chat
async function testChat() {
    try {
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: '¡Hola! ¿Puedes confirmar que eres el modelo qwen/qwen3-4b-2507?',
            model: 'qwen/qwen3-4b-2507',
            max_tokens: 100,
            temperature: 0.5
        });
        
        console.log('\n🤖 Respuesta del AI:');
        console.log(response.data.response);
        console.log(`\n📊 Información:
   - Modelo usado: ${response.data.model}
   - Tokens usados: ${response.data.tokens_used}
   - Tiempo: ${response.data.timestamp}`);
        
    } catch (error) {
        console.log('\n❌ Error en el chat:', error.response?.data || error.message);
    }
}

// Función para hacer una pregunta personalizada
async function askQuestion(question) {
    console.log(`\n❓ Pregunta: ${question}\n`);
    
    try {
        console.log('🔄 Enviando petición al servidor...');
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: question,
            model: 'qwen/qwen3-4b-2507',
            max_tokens: 300,
            temperature: 0.5
        }, {
            timeout: 60000 // 60 segundos
        });
        
        console.log('🤖 Respuesta:');
        console.log(response.data.response);
        console.log(`\n📊 Tokens usados: ${response.data.tokens_used}`);
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        if (error.response) {
            console.log('📋 Detalles completos:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.length === 0) {
    // Sin argumentos, ejecutar prueba de conexión
    testConnection();
} else if (args[0] === 'ask') {
    // Hacer una pregunta personalizada
    const question = args.slice(1).join(' ');
    if (question) {
        askQuestion(question);
    } else {
        console.log('❌ Por favor proporciona una pregunta después de "ask"');
        console.log('   Ejemplo: node test.js ask "¿Cuál es la capital de Francia?"');
    }
} else {
    // Usar todos los argumentos como una pregunta
    const question = args.join(' ');
    askQuestion(question);
}
