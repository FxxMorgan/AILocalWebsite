# 🤖 AI Chat Local

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com/FxxMorgan)
[![LMStudio Compatible](https://img.shields.io/badge/LMStudio-Compatible-blue.svg)](https://lmstudio.ai/)

> Cliente web elegante y ligero para interactuar con modelos de IA locales a través de LMStudio

**Desarrollado con ❤️ por [Feer](https://github.com/FxxMorgan)**

## ✨ Características

- 🎨 **Interfaz moderna** - Diseño responsivo con tema oscuro/claro
- 💬 **Chat inteligente** - Conversaciones fluidas con modelos locales
- 📱 **Móvil optimizado** - Experiencia perfecta en dispositivos móviles
- � **Gestión de chats** - Guarda, edita y organiza conversaciones
- 🛠️ **Configuración avanzada** - Control de temperatura, tokens, modelos
- 🔌 **Compatibilidad total** - Funciona con cualquier modelo en LMStudio
- � **Reintentos automáticos** - Manejo robusto de errores y timeouts
- � **Copia de código** - Botones para copiar bloques de código
- 🎯 **Fallbacks inteligentes** - Soporte para modelos sin formato chat

## 🚀 Inicio Rápido

### Prerrequisitos

- [Node.js](https://nodejs.org/) v16 o superior
- [LMStudio](https://lmstudio.ai/) ejecutándose localmente
- Un modelo descargado en LMStudio

### Instalación

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/FxxMorgan/AI-Chat-Local.git
   cd AI-Chat-Local
   ```

2. **Instala dependencias**
   ```bash
   npm install
   ```

3. **Configura el entorno** (opcional)
   ```bash
   cp .env.example .env
   # Edita .env con tus preferencias
   ```

4. **Configura LMStudio**
   - Abre LMStudio
   - Ve a la pestaña "Local Server"
   - Carga tu modelo preferido (recomendado: qwen/qwen3-4b-2507)
   - Asegúrate de que el servidor esté habilitado en puerto 1234

5. **Inicia el servidor**
   ```bash
   npm start
   ```

6. **Abre en tu navegador**
   ```
   http://localhost:3000
   ```
## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor
PORT=3000

# URL de LMStudio
LMSTUDIO_URL=http://localhost:1234

# Configuración por defecto
DEFAULT_MODEL=qwen/qwen3-4b-2507
DEFAULT_MAX_TOKENS=500
DEFAULT_TEMPERATURE=0.7

# Configuración avanzada
LM_TIMEOUT_MS=60000
LM_MAX_RETRIES=2
VERBOSE_LM=false
WARMUP_ON_START=false

# Modelos que requieren formato raw (separados por comas)
FORCE_RAW_MODELS=nsfw-3b,otro-modelo*
```

## 📖 Uso

### Interfaz Principal

- **Chat principal**: Envía mensajes y recibe respuestas del modelo
- **Barra lateral**: Gestiona conversaciones y ajusta configuraciones
- **Configuraciones**: Modifica temperatura, tokens máximos y modelo activo

### Gestión de Conversaciones

- **Nueva conversación**: Botón `+` en la barra lateral
- **Cambiar conversación**: Click en cualquier chat de la lista
- **Editar título**: Botón de edición en cada conversación
- **Eliminar**: Botón de papelera (individual o todas)

### Atajos de Teclado

- `Enter`: Enviar mensaje
- `Shift + Enter`: Nueva línea
- `Escape`: Cerrar barra lateral (móvil)

## 🛠️ API Endpoints

### Chat
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Hola, ¿cómo estás?",
  "model": "qwen/qwen3-4b-2507",
  "max_tokens": 300,
  "temperature": 0.7,
  "chatId": "optional-chat-id"
}
```

### Gestión de Modelos
```http
GET /api/models              # Listar modelos disponibles
GET /api/status              # Estado del servidor y LMStudio
```

### Gestión de Chats
```http
GET /api/chats               # Listar todas las conversaciones
POST /api/chats              # Crear nueva conversación
GET /api/chats/:id           # Obtener conversación específica
PUT /api/chats/:id           # Actualizar título
DELETE /api/chats/:id        # Eliminar conversación
DELETE /api/chats            # Eliminar todas las conversaciones
```

## 🎨 Personalización

### Temas

El proyecto incluye soporte para tema oscuro/claro automático basado en las preferencias del sistema. Puedes personalizar los colores editando las variables CSS en `public/index.html`.

### Modelos Personalizados

Para añadir soporte para modelos específicos que requieren formatos especiales:

1. Añade el modelo a `FORCE_RAW_MODELS` en `.env`
2. El sistema automáticamente usará fallbacks apropiados

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Desarrollo Local

```bash
# Modo desarrollo con auto-reload
npm run dev

# Ejecutar tests (si existen)
npm test

# Verificar linting
npm run lint
```

## 📝 Estructura del Proyecto

```
AI-Chat-Local/
├── public/
│   ├── index.html          # Interfaz principal
│   ├── script.js           # Lógica del frontend
│   └── style.css           # Estilos (legacy)
├── chats/                  # Almacenamiento de conversaciones
├── server.js               # Servidor Express
├── chat-storage.js         # Sistema de persistencia
├── package.json            # Dependencias
├── .env.example            # Configuración de ejemplo
└── README.md               # Este archivo
```

## 🐛 Solución de Problemas

### LMStudio no conecta

1. Verifica que LMStudio esté ejecutándose
2. Confirma que el servidor local esté habilitado
3. Verifica la URL en `LMSTUDIO_URL`

### Timeouts frecuentes

1. Aumenta `LM_TIMEOUT_MS` en `.env`
2. Habilita `WARMUP_ON_START=true`
3. Reduce `max_tokens` para respuestas más rápidas

### Modelo no funciona

1. Añade el modelo a `FORCE_RAW_MODELS`
2. Verifica que esté cargado en LMStudio
3. Revisa los logs del servidor para detalles

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**Feer** - [@FxxMorgan](https://github.com/FxxMorgan)

## 🙏 Agradecimientos

- [LMStudio](https://lmstudio.ai/) por la increíble plataforma
- [Tailwind CSS](https://tailwindcss.com/) por el sistema de diseño
- [Font Awesome](https://fontawesome.com/) por los iconos
- Comunidad open source por la inspiración

---

<div align="center">
  <strong>⭐ ¡Dale una estrella si te gusta el proyecto! ⭐</strong>
</div>
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

## 👨‍💻 Desarrollador

**Feer** - [GitHub](https://github.com/FxxMorgan)

Si te gusta este proyecto, ¡no olvides darle una ⭐!

---

*Desarrollado con ❤️ usando Node.js, Express, Tailwind CSS y LMStudio*
