const fs = require('fs').promises;
const path = require('path');

// Directorio para almacenar los chats
const CHATS_DIR = path.join(__dirname, 'chats');

// Asegurar que el directorio de chats existe
async function ensureChatsDirectory() {
    try {
        await fs.access(CHATS_DIR);
    } catch {
        await fs.mkdir(CHATS_DIR, { recursive: true });
    }
}

// Generar ID único para un chat
function generateChatId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Obtener todos los chats
async function getAllChats() {
    await ensureChatsDirectory();
    try {
        const files = await fs.readdir(CHATS_DIR);
        const chats = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(CHATS_DIR, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const chat = JSON.parse(content);
                    chats.push({
                        id: chat.id,
                        title: chat.title,
                        createdAt: chat.createdAt,
                        updatedAt: chat.updatedAt,
                        messageCount: chat.messages.length
                    });
                } catch (error) {
                    console.error(`Error leyendo chat ${file}:`, error);
                }
            }
        }
        
        // Ordenar por fecha de actualización (más reciente primero)
        return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
        console.error('Error obteniendo chats:', error);
        return [];
    }
}

// Obtener un chat específico
async function getChat(chatId) {
    await ensureChatsDirectory();
    try {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Chat ${chatId} no encontrado`);
    }
}

// Crear un nuevo chat
async function createChat(title = null) {
    await ensureChatsDirectory();
    const chatId = generateChatId();
    const now = new Date().toISOString();
    
    const chat = {
        id: chatId,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        createdAt: now,
        updatedAt: now,
        messages: []
    };
    
    const filePath = path.join(CHATS_DIR, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
    
    return chat;
}

// Agregar mensaje a un chat
async function addMessageToChat(chatId, message, isUser = false) {
    const chat = await getChat(chatId);
    
    const newMessage = {
        id: generateChatId(),
        content: message,
        isUser: isUser,
        timestamp: new Date().toISOString()
    };
    
    chat.messages.push(newMessage);
    chat.updatedAt = new Date().toISOString();
    
    // Si es el primer mensaje del usuario, usar parte de él como título
    if (isUser && chat.messages.filter(m => m.isUser).length === 1) {
        chat.title = message.length > 50 ? message.substring(0, 47) + '...' : message;
    }
    
    const filePath = path.join(CHATS_DIR, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
    
    return chat;
}

// Eliminar un chat
async function deleteChat(chatId) {
    await ensureChatsDirectory();
    try {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        throw new Error(`Error eliminando chat ${chatId}: ${error.message}`);
    }
}

// Actualizar título de un chat
async function updateChatTitle(chatId, newTitle) {
    const chat = await getChat(chatId);
    chat.title = newTitle;
    chat.updatedAt = new Date().toISOString();
    
    const filePath = path.join(CHATS_DIR, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
    
    return chat;
}

module.exports = {
    getAllChats,
    getChat,
    createChat,
    addMessageToChat,
    deleteChat,
    updateChatTitle
};
