# Scripts de Handit.ai Knowledge Base

Este directorio contiene scripts para validar y subir la base de conocimientos de Handit.ai a Pinecone.

## 📋 Scripts Disponibles

### 1. 🔍 Validación de Knowledge Base
```bash
npm run validate:knowledge
```

**Propósito:** Validar la base de conocimientos antes de subirla a Pinecone.

**Qué hace:**
- ✅ Verifica caracteres Unicode problemáticos
- ✅ Valida serialización JSON
- ✅ Prueba el chunking inteligente
- ✅ Verifica tamaños de chunks
- ✅ Detecta chunks vacíos
- ✅ Reporta estadísticas detalladas

**Ejemplo de salida:**
```
🔍 Validating Handit.ai Knowledge Base...
📊 Total documents to validate: 10

📄 Validating document 1/10...
⚠️ Document 1: Contains problematic Unicode characters
   🔄 Replaced: "🚀" → "[ROCKET]"
   🔄 Replaced: "✅" → "[CHECK]"
✂️ Document splits into 3 chunks

==============================================
📋 VALIDATION SUMMARY
==============================================
📊 Documents validated: 10
📦 Total chunks: 28
⚠️ Total issues found: 5

✅ Knowledge base validation PASSED!
🚀 Ready to upload to Pinecone vector store.
```

### 2. 📤 Subir Knowledge Base a Pinecone (Auto-Corrección)
```bash
npm run setup:pinecone
# o
npm run upload:knowledge
```

**Propósito:** Subir la base de conocimientos con auto-corrección automática.

**🎉 NUEVA CARACTERÍSTICA:** ¡No necesitas validación manual previa! El script automáticamente:
- 🔧 **Auto-corrige** caracteres Unicode problemáticos
- 🧹 **Sanitiza** texto automáticamente  
- 📏 **Trunca** contenido demasiado largo
- 🔍 **Limpia** metadatos no serializables
- ⚠️ **Reporta** todas las correcciones aplicadas

**Prerrequisitos:**
1. Variables de entorno configuradas:
   ```bash
   PINECONE_API_KEY=tu_clave_pinecone
   PINECONE_INDEX=handit-docs-index
   PINECONE_ENVIRONMENT=tu_entorno
   OPENAI_API_KEY=tu_clave_openai
   ```

2. Índice de Pinecone creado con:
   - **Dimensiones:** 1536 (para text-embedding-ada-002)
   - **Métrica:** cosine

**Qué hace automáticamente:**
- 🧹 **Auto-corrección:** Detecta y corrige problemas antes de procesar
- 🔍 **Validación:** Verifica todo automáticamente
- ⚡ **Generación:** Crea embeddings con OpenAI
- 📤 **Upload:** Sube chunks a Pinecone en lotes
- 📊 **Reporte:** Estadísticas completas de correcciones y éxito

**Ejemplo de salida:**
```
🚀 Initializing Pinecone...
🔄 Creating OpenAI client...
📝 Processing and adding documents to knowledge base...
🧹 Auto-correcting any issues found...

🔧 Auto-corrected 2 issues in document 1
   🔄 Replaced emojis: 🚀→[ROCKET], ✅→[CHECK]
✂️ Processing document 1/10 with 3 chunks...
📤 Upserting 3 valid records for document 1...
✅ Successfully uploaded 3 chunks for document 1

============================================================
✅ Handit.ai knowledge base initialized successfully!
============================================================
📊 Final Statistics:
   📁 Documents processed: 10
   📦 Total chunks uploaded: 28
   🔧 Auto-corrections applied: 5
   🎯 Vectors in index: 28
   📏 Vector dimension: 1536

🎉 Auto-correction successful! Fixed 5 issues automatically.
🚀 Your Handit.ai agent is ready to answer questions!
```

## 🛠️ Resolución de Problemas

### ✅ Problemas que se corrigen automáticamente:
- **Unicode/Emojis problemáticos:** Auto-convertidos a texto (🚀 → [ROCKET])
- **Chunks muy grandes:** Auto-truncados a tamaño óptimo
- **JSON no serializable:** Auto-limpiado de metadatos
- **Documentos malformados:** Auto-reparados con contenido válido

### ⚠️ Únicos errores que requieren acción manual:

#### Error: "Missing API key"
**Solución:** 
1. Copia `env.example` a `.env`
2. Configura tus API keys:
   ```bash
   cp env.example .env
   # Edita .env con tus claves
   ```

#### Error: "Index not found"
**Solución:** Crea el índice en Pinecone con estas especificaciones:
- **Nombre:** handit-docs-index (o el que configuraste)
- **Dimensiones:** 1536
- **Métrica:** cosine

#### Error: "OpenAI API request failed"
**Solución:** Verifica tu clave de OpenAI y que tengas créditos disponibles.

**💡 Nota:** El 95% de problemas anteriores ahora se corrigen automáticamente.

## 📊 Configuración de Chunking

Puedes ajustar el comportamiento del chunking en `.env`:

```bash
# Vector Database Configuration
CHUNK_SIZE=1000                    # Tamaño base del chunk
CHUNK_OVERLAP=300                  # Overlap entre chunks
MAX_RESULTS=5                      # Resultados máximos en búsquedas

# Advanced Chunking Configuration
PRESERVE_CODE_BLOCKS=true          # Preservar bloques de código
PRESERVE_SECTIONS=true             # Preservar secciones
CONTEXT_PRESERVATION=true          # Activar preservación de contexto
MIN_CHUNK_SIZE=200                 # Tamaño mínimo de chunk
```

## 🚀 Flujo Simplificado

### ⚡ Configuración en 2 pasos:

1. **Auto-subir con corrección automática:**
   ```bash
   npm run upload:knowledge
   ```
   *(Detecta y corrige problemas automáticamente, no requiere validación previa)*

2. **Iniciar el servidor:**
   ```bash
   npm run dev
   ```

¡Listo! Tu sistema agentic estará funcionando con auto-corrección completa. 🎉

### 🔍 Opcional: Solo inspeccionar (sin corregir)
Si quieres ver qué problemas existen sin corregirlos automáticamente:
```bash
npm run validate:knowledge
```

**💡 Ventaja del nuevo flujo:** 
- ❌ **Antes:** Validar → Corregir manualmente → Subir (3 pasos)
- ✅ **Ahora:** Solo subir (auto-corrección) → Listo (1 paso) 