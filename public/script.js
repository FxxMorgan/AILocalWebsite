class AIChat {
    constructor() {
        this.currentModel = null;
        this.totalTokens = 0;
        this.messageCount = 0;
        this.isConnected = false;
        this.currentChatId = null;
        this.chats = [];
    this.DOM_READY = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkServerStatus();
        this.loadModels();
        this.loadChats();
    this.initTheme();
    this.initWelcomeTime();
    this.initMobileSidebar();
    this.DOM_READY = true;
    }

    initializeElements() {
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.modelSelect = document.getElementById('model-select');
        this.maxTokensInput = document.getElementById('max-tokens');
        this.temperatureInput = document.getElementById('temperature');
        this.temperatureValue = document.getElementById('temperature-value');
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearBtn = document.getElementById('clear-chat');
        this.currentModelSpan = document.getElementById('current-model');
        this.tokensCountSpan = document.getElementById('tokens-count');
        this.messageCountSpan = document.getElementById('message-count');
        
        // Elementos de gestión de chats
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.chatsList = document.getElementById('chats-list');
    }

    setupEventListeners() {
        // Enviar mensaje
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter para enviar, Shift+Enter para nueva línea
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                
                // Prevenir envío si ya está en progreso
                if (!this.sendBtn.disabled && this.userInput.value.trim()) {
                    this.sendMessage();
                }
            }
        });

        // Actualizar valor de temperatura en tiempo real
        this.temperatureInput.addEventListener('input', (e) => {
            this.temperatureValue.textContent = e.target.value;
        });

        // Limpiar chat
        this.clearBtn.addEventListener('click', () => this.clearChat());

        // Cambio de modelo
        this.modelSelect.addEventListener('change', (e) => {
            this.currentModel = e.target.value;
            this.currentModelSpan.textContent = e.target.value || 'Automático';
        });

        // Auto-resize del textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';
        });

        // Event listeners para gestión de chats
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.createNewChat());
        }
        
        // Botón para eliminar todas las conversaciones
        const clearAllChatsBtn = document.getElementById('clear-all-chats-btn');
        if (clearAllChatsBtn) {
            clearAllChatsBtn.addEventListener('click', () => this.confirmDeleteAllChats());
        }
        
        // Prevenir envío con doble clic
        this.sendBtn.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            this.isConnected = data.lmstudio_connected;
            this.updateStatusIndicator();
            
        } catch (error) {
            console.error('Error checking server status:', error);
            this.isConnected = false;
            this.updateStatusIndicator();
        }
    }

    updateStatusIndicator() {
        if (this.isConnected) {
            this.statusDot.className = 'w-3 h-3 rounded-full bg-green-400';
            this.statusText.textContent = 'Conectado a LMStudio';
        } else {
            this.statusDot.className = 'w-3 h-3 rounded-full bg-red-400 animate-pulse';
            this.statusText.textContent = 'Desconectado';
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            
            if (data.success) {
                this.populateModelSelect(data.models);
            } else {
                console.error('Error loading models:', data.error);
                this.modelSelect.innerHTML = '<option value="">Error cargando modelos</option>';
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            this.modelSelect.innerHTML = '<option value="">Sin conexión</option>';
        }
    }

    populateModelSelect(models) {
        this.modelSelect.innerHTML = '<option value="">Selección automática</option>';
        
        const preferredModel = 'qwen/qwen3-4b-2507';
        let hasPreferredModel = false;
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            
            // Marcar el modelo preferido si está disponible
            if (model === preferredModel) {
                option.selected = true;
                hasPreferredModel = true;
                this.currentModel = model;
                this.currentModelSpan.textContent = model;
            }
            
            this.modelSelect.appendChild(option);
        });
        
        // Si no está disponible el modelo preferido, mostrar mensaje
        if (!hasPreferredModel && models.length > 0) {
            console.log(`Modelo preferido ${preferredModel} no encontrado. Modelos disponibles:`, models);
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // Prevenir envíos múltiples
        if (this.sendBtn.disabled) {
            console.warn('⚠️ Envío ya en progreso, ignorando duplicado');
            return;
        }

        // Si no hay chat activo, crear uno automáticamente
        if (!this.currentChatId) {
            console.log('📝 Creando nuevo chat automáticamente...');
            await this.createNewChat();
            
            // Verificar que se creó correctamente
            if (!this.currentChatId) {
                this.addMessage('❌ Error creando nueva conversación. Inténtalo de nuevo.', 'bot', true);
                return;
            }
        }

        // Deshabilitar input mientras se procesa
        this.setInputDisabled(true);
        
        // Mostrar mensaje del usuario
        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.userInput.style.height = 'auto';

        // Mostrar indicador de escritura
        const typingIndicator = this.addTypingIndicator();

        try {
            console.log(`📤 Enviando mensaje al chat: ${this.currentChatId}`);
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    model: this.currentModel,
                    max_tokens: parseInt(this.maxTokensInput.value),
                    temperature: parseFloat(this.temperatureInput.value),
                    chatId: this.currentChatId
                })
            });

            // Remover indicador de escritura
            if (typingIndicator) {
                typingIndicator.remove();
            }

            const data = await response.json();

            if (data.success) {
                this.addMessage(data.response, 'bot');
                this.updateTokenCount(data.tokens_used);
                this.currentModelSpan.textContent = data.model || 'Desconocido';
                this.messageCount++;
                this.messageCountSpan.textContent = this.messageCount;
                
                // Si el chatId cambió (chat recreado), actualizar
                if (data.chatId && data.chatId !== this.currentChatId) {
                    console.log(`🔄 Chat actualizado de ${this.currentChatId} a ${data.chatId}`);
                    this.currentChatId = data.chatId;
                    await this.loadChats();
                }
            } else {
                this.addMessage(`❌ Error: ${data.error}`, 'bot', true);
            }

        } catch (error) {
            // Remover indicador de escritura en caso de error
            if (typingIndicator) {
                typingIndicator.remove();
            }
            console.error('❌ Error sending message:', error);
            this.addMessage('❌ Error de conexión. Verifica que el servidor esté ejecutándose.', 'bot', true);
        } finally {
            this.setInputDisabled(false);
            this.userInput.focus();
        }
    }

    addMessage(content, type, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex items-start space-x-2 sm:space-x-3 animate-fadeIn`;
        
        if (type === 'user') {
            messageDiv.className += ' justify-end';
            messageDiv.innerHTML = `
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl rounded-tr-none p-3 sm:p-4 max-w-[85%] sm:max-w-3xl text-white">
                    <div class="flex items-center space-x-2 mb-1">
                        <i class="fas fa-user text-xs sm:text-sm"></i>
                        <span class="font-semibold text-xs sm:text-sm">Tú</span>
                    </div>
                    <p class="leading-relaxed text-sm sm:text-base">${this.escapeHtml(content)}</p>
                    <div class="text-xs opacity-70 mt-2 flex items-center">
                        <i class="far fa-clock mr-1"></i>
                        ${new Date().toLocaleTimeString()}
                    </div>
                </div>
                <div class="bg-blue-500 p-1.5 sm:p-2 rounded-full flex-shrink-0">
                    <i class="fas fa-user text-sm sm:text-base text-white"></i>
                </div>
            `;
        } else {
            const errorClass = isError ? 'border-red-400/50 bg-red-900/20' : 'border-white/20';
            messageDiv.innerHTML = `
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 sm:p-2 rounded-full flex-shrink-0">
                    <i class="fas fa-robot text-sm sm:text-base text-white"></i>
                </div>
                <div class="glass rounded-xl sm:rounded-2xl rounded-tl-none p-3 sm:p-4 max-w-[85%] sm:max-w-3xl border ${errorClass}">
                    <div class="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2">
                        <span class="font-semibold text-blue-300 text-sm sm:text-base">AI Assistant</span>
                        <span class="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded-full w-fit">${this.currentModel || 'AI'}</span>
                    </div>
                    <div class="text-gray-200 leading-relaxed text-sm sm:text-base">${this.formatAIResponse(content)}</div>
                    <div class="text-xs text-gray-500 mt-2 flex items-center">
                        <i class="far fa-clock mr-1"></i>
                        ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            `;
        }

        this.chatMessages.appendChild(messageDiv);

        // Scroll al final
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        // Cerrar sidebar en móvil después de enviar mensaje
        if (window.innerWidth < 768) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobile-sidebar-overlay');
            if (sidebar && overlay) {
                sidebar.classList.remove('open');
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    }

    addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'flex items-start space-x-2 sm:space-x-3 animate-fadeIn typing-indicator-message';
        typingDiv.innerHTML = `
            <div class="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 sm:p-2 rounded-full flex-shrink-0">
                <i class="fas fa-robot text-sm sm:text-base text-white"></i>
            </div>
            <div class="glass rounded-xl sm:rounded-2xl rounded-tl-none p-3 sm:p-4 max-w-[85%] sm:max-w-3xl border border-white/20">
                <div class="flex items-center space-x-2 mb-2">
                    <span class="font-semibold text-blue-300 text-sm sm:text-base">AI Assistant</span>
                    <span class="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded-full">Escribiendo...</span>
                </div>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return typingDiv;
    }

    formatAIResponse(content) {
        // Sanitizar primero para prevenir inyección XSS (escapar & < >)
        const safe = (txt) => txt
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Extraer bloques de código y reemplazar por marcadores
        const codeBlocks = [];
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code, idx) => {
            const id = codeBlocks.length;
            codeBlocks.push({ lang: lang || 'text', code: code });
            return `[[CODE_BLOCK_${id}]]`;
        });

        // Escapar el resto
        content = safe(content);

        // Formatear inline code (ya escapado)
        content = content.replace(/`([^`]+)`/g, (m, c) => `<code class="bg-black/40 px-1 sm:px-2 py-1 rounded text-green-300 text-xs sm:text-sm">${c}</code>`);

        // Bold & italics (permitir marcado básico)
        content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-300">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-purple-300">$1</em>');

        // Saltos de línea
        content = content.replace(/\n/g, '<br>');

        // Reinsertar bloques de código seguros
        codeBlocks.forEach((blk, i) => {
            const escaped = safe(blk.code)
                .replace(/`/g, '&#96;');
            const html = `
            <div class="code-block-wrapper group my-3">
                <button class="copy-btn" data-code-index="${i}" aria-label="Copiar código">
                    <i class="fas fa-copy"></i><span>Copiar</span>
                </button>
                <pre class="bg-black/40 rounded-lg p-2 sm:p-3 overflow-x-auto text-xs sm:text-sm"><code class="language-${blk.lang} text-green-300">${escaped}</code></pre>
            </div>`;
            content = content.replace(`[[CODE_BLOCK_${i}]]`, html);
        });

        return content.trim();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setInputDisabled(disabled) {
        this.userInput.disabled = disabled;
        this.sendBtn.disabled = disabled;
        
        const sendIcon = this.sendBtn.querySelector('.send-icon');
        const loadingIcon = this.sendBtn.querySelector('.loading-icon');
        const sendText = this.sendBtn.querySelector('.send-text');
        const loadingText = this.sendBtn.querySelector('.loading-text');
        
        if (disabled) {
            sendIcon.classList.add('hidden');
            loadingIcon.classList.remove('hidden');
            sendText.classList.add('hidden');
            loadingText.classList.remove('hidden');
        } else {
            sendIcon.classList.remove('hidden');
            loadingIcon.classList.add('hidden');
            sendText.classList.remove('hidden');
            loadingText.classList.add('hidden');
        }
    }

    updateTokenCount(tokens) {
        this.totalTokens += tokens;
        this.tokensCountSpan.textContent = this.totalTokens.toLocaleString();
    }

    clearChat() {
        // Mantener solo el mensaje de bienvenida
        const welcomeMessage = this.chatMessages.querySelector('.animate-fadeIn');
        this.chatMessages.innerHTML = '';
        if (welcomeMessage) {
            this.chatMessages.appendChild(welcomeMessage);
        }
        
        this.totalTokens = 0;
        this.messageCount = 0;
        this.tokensCountSpan.textContent = '0';
        this.messageCountSpan.textContent = '0';
        this.currentChatId = null;
        
        this.userInput.focus();
    }

    // === Inicializaciones auxiliares ===
    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const html = document.documentElement;
        if (savedTheme) {
            html.classList.toggle('dark', savedTheme === 'dark');
        } else if (prefersDark) {
            html.classList.add('dark');
        }
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                html.classList.toggle('dark');
                const icon = toggle.querySelector('i');
                if (html.classList.contains('dark')) {
                    icon.className = 'fas fa-sun text-lg';
                    toggle.title = 'Modo claro';
                    localStorage.setItem('theme', 'dark');
                } else {
                    icon.className = 'fas fa-moon text-lg';
                    toggle.title = 'Modo oscuro';
                    localStorage.setItem('theme', 'light');
                }
            });
        }
    }

    initWelcomeTime() {
        const el = document.getElementById('welcome-time');
        if (el) {
            el.textContent = new Date().toLocaleString('es-ES', {
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
            });
        }
    }

    initMobileSidebar() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('mobile-sidebar-overlay');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        if (!mobileMenuBtn || !sidebar || !sidebarOverlay || !closeSidebarBtn) return;
        const openSidebar = () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => { sidebarOverlay.style.opacity = '1'; });
        };
        const closeSidebar = () => {
            sidebarOverlay.style.opacity = '0';
            sidebar.classList.remove('open');
            setTimeout(() => {
                sidebarOverlay.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        };
        mobileMenuBtn.addEventListener('click', openSidebar);
        closeSidebarBtn.addEventListener('click', closeSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 768 && !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target) && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        });
        window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeSidebar(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar(); });
    }

    // === FUNCIONES DE GESTIÓN DE CHATS ===

    async loadChats() {
        try {
            const response = await fetch('/api/chats');
            const data = await response.json();
            
            if (data.success) {
                this.chats = data.chats;
                this.renderChatsList();
            }
        } catch (error) {
            console.error('Error cargando chats:', error);
        }
    }

    renderChatsList() {
        if (!this.chatsList) return;
        
        this.chatsList.innerHTML = '';
        
        if (this.chats.length === 0) {
            this.chatsList.innerHTML = `
                <div class="text-center py-6">
                    <i class="fas fa-comment-slash text-3xl text-gray-500 mb-2"></i>
                    <p class="text-gray-400 text-sm">No hay conversaciones</p>
                    <p class="text-gray-500 text-xs mt-1">Haz clic en "+" para crear una nueva</p>
                </div>
            `;
            return;
        }

        this.chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item relative group p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all ${
                chat.id === this.currentChatId ? 'bg-blue-500/20 border-blue-400/50' : ''
            }`;
            
            chatElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0 pr-2">
                        <h4 class="text-sm font-medium text-white truncate mb-1">${this.escapeHtml(chat.title)}</h4>
                        <div class="flex items-center space-x-2 text-xs text-gray-400">
                            <span class="flex items-center">
                                <i class="fas fa-comment-dots mr-1"></i>
                                ${chat.messageCount} mensajes
                            </span>
                            <span class="flex items-center">
                                <i class="far fa-clock mr-1"></i>
                                ${this.formatRelativeTime(chat.updatedAt)}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="edit-chat-btn text-blue-400 hover:text-blue-300 p-1.5 rounded hover:bg-blue-500/20 transition-all" 
                                data-chat-id="${chat.id}" title="Editar título">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button class="delete-chat-btn text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/20 transition-all" 
                                data-chat-id="${chat.id}" title="Eliminar conversación">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Click para cargar chat
            chatElement.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-chat-btn') && !e.target.closest('.edit-chat-btn')) {
                    this.loadChat(chat.id);
                }
            });
            
            // Click para eliminar chat
            const deleteBtn = chatElement.querySelector('.delete-chat-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmDeleteChat(chat.id, chat.title);
            });
            
            // Click para editar título
            const editBtn = chatElement.querySelector('.edit-chat-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editChatTitle(chat.id, chat.title);
            });
            
            this.chatsList.appendChild(chatElement);
        });
    }

    async createNewChat() {
        try {
            // Prevenir creación múltiple
            if (this.newChatBtn.disabled) {
                console.warn('⚠️ Creación de chat ya en progreso');
                return;
            }
            
            this.newChatBtn.disabled = true;
            
            const response = await fetch('/api/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: `Nueva conversación - ${new Date().toLocaleString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}`
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.clearChat();
                this.currentChatId = data.chat.id;
                await this.loadChats();
                console.log('✅ Nuevo chat creado:', data.chat.id);
                
                // Enfocar en el input para escribir
                this.userInput.focus();
            } else {
                console.error('❌ Error creando chat:', data.error);
                alert('Error creando nueva conversación. Inténtalo de nuevo.');
            }
        } catch (error) {
            console.error('❌ Error creando nuevo chat:', error);
            alert('Error de conexión. Verifica que el servidor esté funcionando.');
        } finally {
            this.newChatBtn.disabled = false;
        }
    }

    async loadChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentChatId = chatId;
                this.clearChat();
                
                // Cargar mensajes del chat
                data.chat.messages.forEach(message => {
                    this.addMessage(message.content, message.isUser ? 'user' : 'bot');
                });
                
                this.renderChatsList(); // Actualizar la lista para marcar el chat activo
                console.log('Chat cargado:', chatId);
            }
        } catch (error) {
            console.error('Error cargando chat:', error);
        }
    }

    async deleteChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (this.currentChatId === chatId) {
                    this.clearChat();
                }
                await this.loadChats();
                console.log('✅ Chat eliminado:', chatId);
            } else {
                console.error('❌ Error eliminando chat:', data.error);
                alert('Error eliminando la conversación');
            }
        } catch (error) {
            console.error('❌ Error eliminando chat:', error);
            alert('Error de conexión');
        }
    }

    confirmDeleteChat(chatId, chatTitle) {
        // Crear modal de confirmación personalizado
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="glass-card rounded-2xl p-6 max-w-md w-full border border-white/20 animate-slide-up">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20 mb-4">
                        <i class="fas fa-trash text-red-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Eliminar conversación</h3>
                    <p class="text-text-secondary mb-4">
                        ¿Estás seguro de que quieres eliminar la conversación <strong class="text-text-primary">"${this.escapeHtml(chatTitle)}"</strong>?
                    </p>
                    <p class="text-sm text-text-muted mb-6">Esta acción no se puede deshacer.</p>
                    
                    <div class="flex space-x-3">
                        <button id="cancel-delete" class="flex-1 glass-card px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-all text-text-secondary">
                            Cancelar
                        </button>
                        <button id="confirm-delete" class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg transition-all">
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        modal.querySelector('#cancel-delete').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#confirm-delete').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.deleteChat(chatId);
        });
        
        // Cerrar con Escape o click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    async editChatTitle(chatId, currentTitle) {
        const newTitle = prompt('Nuevo título para la conversación:', currentTitle);
        if (newTitle && newTitle.trim() !== currentTitle) {
            try {
                const response = await fetch(`/api/chats/${chatId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: newTitle.trim()
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    await this.loadChats();
                    console.log('✅ Título actualizado');
                } else {
                    console.error('❌ Error actualizando título:', data.error);
                    alert('Error actualizando el título');
                }
            } catch (error) {
                console.error('❌ Error actualizando título:', error);
                alert('Error de conexión');
            }
        }
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }

    confirmDeleteAllChats() {
        if (this.chats.length === 0) {
            alert('No hay conversaciones para eliminar');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="glass-card rounded-2xl p-6 max-w-md w-full border border-white/20 animate-slide-up">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20 mb-4">
                        <i class="fas fa-exclamation-triangle text-red-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary mb-2">Eliminar todas las conversaciones</h3>
                    <p class="text-text-secondary mb-4">
                        ¿Estás seguro de que quieres eliminar <strong class="text-red-400">${this.chats.length}</strong> conversaciones?
                    </p>
                    <p class="text-sm text-text-muted mb-6">Esta acción no se puede deshacer y se perderán todos los mensajes.</p>
                    
                    <div class="flex space-x-3">
                        <button id="cancel-delete-all" class="flex-1 glass-card px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-all text-text-secondary">
                            Cancelar
                        </button>
                        <button id="confirm-delete-all" class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg transition-all">
                            Eliminar todas
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        modal.querySelector('#cancel-delete-all').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#confirm-delete-all').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.deleteAllChats();
        });
        
        // Cerrar con Escape o click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    async deleteAllChats() {
        try {
            console.log(`🗑️ Eliminando ${this.chats.length} conversaciones...`);
            
            // Usar el endpoint optimizado para eliminar todas
            const response = await fetch('/api/chats', { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
                this.clearChat();
                await this.loadChats();
                
                console.log('✅ Todas las conversaciones eliminadas');
                this.showNotification(`${this.chats.length} conversaciones eliminadas`, 'success');
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('❌ Error eliminando conversaciones:', error);
            
            // Fallback: eliminar una por una
            try {
                const deletePromises = this.chats.map(chat => 
                    fetch(`/api/chats/${chat.id}`, { method: 'DELETE' })
                );
                
                await Promise.all(deletePromises);
                
                this.clearChat();
                await this.loadChats();
                
                console.log('✅ Conversaciones eliminadas (fallback)');
                this.showNotification('Conversaciones eliminadas', 'success');
                
            } catch (fallbackError) {
                console.error('❌ Error en fallback:', fallbackError);
                this.showNotification('Error eliminando conversaciones', 'error');
            }
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 glass-card rounded-lg p-4 border border-white/20 animate-slide-up max-w-sm`;
        
        const iconClass = type === 'success' ? 'fa-check-circle text-green-400' : 
                         type === 'error' ? 'fa-exclamation-circle text-red-400' : 
                         'fa-info-circle text-blue-400';
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas ${iconClass}"></i>
                <span class="text-text-primary text-sm">${message}</span>
                <button class="text-text-muted hover:text-text-primary ml-auto">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
        
        // Manual close
        notification.querySelector('button').addEventListener('click', () => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
    }
}

// Función para insertar una pregunta de ejemplo
function insertExampleQuestion(question) {
    const userInput = document.getElementById('user-input');
    userInput.value = question;
    userInput.focus();
    
    // Auto-resize
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    
    // Cerrar sidebar en móvil si está abierto
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if (sidebar && overlay && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const chat = new AIChat();
    // Polling estado cada 30s
    setInterval(() => chat.checkServerStatus(), 30000);
    // Delegación para botones copiar código
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-btn');
        if (btn) {
            const pre = btn.parentElement.querySelector('pre code');
            if (pre) {
                const raw = pre.textContent;
                navigator.clipboard.writeText(raw).then(() => {
                    btn.classList.add('copied');
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Copiado</span>';
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.innerHTML = '<i class="fas fa-copy"></i><span>Copiar</span>';
                    }, 1800);
                });
            }
        }
    });
});

// Exponer función ejemplo global
window.insertExampleQuestion = insertExampleQuestion;
