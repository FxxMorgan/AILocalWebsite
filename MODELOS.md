# 🤖 Guía de Modelos para LMStudio

## Modelos Recomendados por Tamaño (de menor a mayor)

### 🟢 **Modelos Ligeros (2-4GB RAM)**
Perfectos para sistemas con poca memoria:

1. **microsoft/Phi-3-mini-4k-instruct** - 3.8B parámetros
   - Muy rápido y eficiente
   - Excelente para tareas generales
   - Funciona bien en laptops

2. **microsoft/Phi-3.5-mini-instruct** - 3.8B parámetros
   - Versión mejorada del Phi-3 mini
   - Mejor comprensión de contexto

### 🟡 **Modelos Medianos (4-8GB RAM)**
Buen balance entre rendimiento y recursos:

3. **meta-llama/Llama-3.2-3B-Instruct** - 3B parámetros
   - Muy buena calidad de respuestas
   - Rápido en inferencia

4. **microsoft/Phi-3-medium-4k-instruct** - 14B parámetros
   - Mucho mejor en tareas complejas
   - Requiere más memoria

### 🟠 **Modelos Grandes (8-16GB RAM)**
Para sistemas con más recursos:

5. **meta-llama/Llama-3.2-7B-Instruct** - 7B parámetros
   - Excelente calidad
   - Muy bueno para programación

6. **meta-llama/Llama-3.1-8B-Instruct** - 8B parámetros
   - Una de las mejores opciones
   - Muy versátil

### 🔴 **Modelos Muy Grandes (16GB+ RAM)**
Solo para sistemas potentes:

7. **openai/gpt-oss-20b** - 20B parámetros
   - Muy alta calidad
   - Requiere mucha memoria
   - Puede ser lento en sistemas normales

## 🛠️ **Configuración Recomendada por Sistema**

### **Sistema Básico (8GB RAM o menos)**
```
Modelo recomendado: Phi-3-mini-4k-instruct
Max tokens: 300-500
Temperature: 0.7
```

### **Sistema Intermedio (8-16GB RAM)**
```
Modelo recomendado: Llama-3.2-3B o Llama-3.2-7B
Max tokens: 500-1000
Temperature: 0.7
```

### **Sistema Potente (16GB+ RAM)**
```
Modelo recomendado: Llama-3.1-8B o superior
Max tokens: 1000-2048
Temperature: 0.7
```

## 📥 **Cómo Descargar Modelos en LMStudio**

1. Abre LMStudio
2. Ve a la pestaña "Search" o "Models"
3. Busca el nombre del modelo (ej: "Phi-3-mini")
4. Haz clic en "Download"
5. Espera a que termine la descarga
6. Ve a la pestaña "Developer"
7. Selecciona el modelo descargado
8. Haz clic en "Start Server"

## ⚡ **Optimización de Rendimiento**

### **Para sistemas lentos:**
- Usa modelos quantizados (Q4, Q5, Q8)
- Reduce max_tokens a 200-300
- Baja la temperatura a 0.5
- Cierra otras aplicaciones

### **Para mejor calidad:**
- Usa modelos más grandes si tienes RAM
- Aumenta max_tokens a 1000+
- Experimenta con temperature entre 0.7-0.9

## 🔍 **Verificar Recursos del Sistema**

### **Windows:**
- Abre "Administrador de tareas" (Ctrl+Shift+Esc)
- Ve a la pestaña "Rendimiento"
- Mira "Memoria" para ver RAM disponible

### **Recomendación:**
- Deja al menos 2-4GB de RAM libre para el sistema
- El modelo debería usar máximo 60-70% de tu RAM total
