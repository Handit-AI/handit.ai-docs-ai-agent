# Sistema de Conversaciones con PostgreSQL + Agentic System

Este sistema implementa un manejo completo de conversaciones para el agente AI de Handit.ai, utilizando PostgreSQL como base de datos principal y un **Agentic System** para guiar usuarios paso a paso.

## 🧠 Agentic System Architecture

### **Multi-Node System**
El sistema agentic está compuesto por múltiples nodos especializados:

1. **📊 Analysis Node** - Analiza el objetivo de la conversación
2. **🎯 Planning Node** - Determina el plan de acción
3. **⚡ Execution Node** - Ejecuta acciones específicas
4. **🔄 State Management Node** - Mantiene el estado de la conversación
5. **📈 Progress Tracking Node** - Rastrea el progreso del setup

### **Flujo de Trabajo Agentic**
```
User Input → Analysis → Planning → Execution → State Update → Response
```

## 🏗️ Arquitectura

### Base de Datos
- **PostgreSQL** con extensión UUID para identificadores únicos
- **3 tablas principales**:
  - `conversations` - Metadatos de conversaciones
  - `messages` - Mensajes individuales 
  - `knowledge_usage` - Tracking de uso de chunks de conocimiento

### Características Principales
- ✅ **Identificación por Session ID (UUID)** - Más seguro que IP
- ✅ **Historial completo** - Todas las conversaciones se mantienen
- ✅ **Contexto automático** - El AI usa el historial para respuestas coherentes
- ✅ **Analytics** - Tracking de chunks más útiles
- ✅ **Metadatos ricos** - Tiempo de procesamiento, scores de confianza
- ✅ **Triggers automáticos** - Actualizaciones de estadísticas

## 🚀 Configuración

### 1. Instalar Dependencias

```bash
npm install pg uuid
```

### 2. Configurar PostgreSQL

```bash
# Crear base de datos
createdb handit_ai

# O usar Docker
docker run --name handit-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar configuración de PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=handit_ai
DB_USER=postgres
DB_PASSWORD=postgres
```

### 4. Ejecutar Migraciones

```bash
npm run db:setup
```

## 🔧 Uso del Sistema

### 1. Crear Nueva Sesión

```bash
curl -X POST http://localhost:3000/api/ai/session
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "conversationId": "123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Hacer Preguntas con Contexto

```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "¿Qué es Handit.ai?",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "language": "es"
  }'
```

### 3. Obtener Historial de Conversación

```bash
curl -X GET "http://localhost:3000/api/ai/conversation/550e8400-e29b-41d4-a716-446655440000?limit=10"
```

### 4. Analytics del Sistema

```bash
curl -X GET http://localhost:3000/api/ai/analytics
```

## 📊 Estructura de Datos

### Tabla `conversations`
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    client_ip INET,
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    context_summary TEXT,
    tags TEXT[],
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'
);
```

### Tabla `messages`
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    context_used TEXT[],
    evaluation_scores JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla `knowledge_usage`
```sql
CREATE TABLE knowledge_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id),
    chunk_id VARCHAR(255) NOT NULL,
    relevance_score FLOAT,
    used_in_response BOOLEAN DEFAULT false,
    user_feedback INTEGER
);
```

## 🔍 Funcionalidades Avanzadas

### 1. Contexto Automático
El sistema automáticamente incluye las últimas 6 conversaciones en el contexto del LLM:

```javascript
// El AI recibe automáticamente:
// - Documentación relevante (RAG)
// - Historial de conversación reciente
// - Contexto de la sesión actual
```

### 2. Tracking de Conocimiento
Se registra qué chunks de Pinecone son más útiles:

```sql
-- Chunks más efectivos
SELECT 
    chunk_id,
    COUNT(*) as usage_count,
    AVG(relevance_score) as avg_relevance
FROM knowledge_usage
GROUP BY chunk_id
ORDER BY usage_count DESC;
```

### 3. Analytics en Tiempo Real
- Tiempo de procesamiento promedio
- Chunks más utilizados
- Patrones de conversación
- Estadísticas por sesión

## 🛠️ Scripts de Administración

### Verificar Estado de Migraciones
```bash
npm run db:status
```

### Migrar Base de Datos
```bash
npm run db:migrate
```

### Limpiar Conversaciones Antiguas
```javascript
// Archivo: scripts/cleanup.js
const conversationService = new ConversationService();
await conversationService.archiveOldConversations(30); // 30 días
```

## 🔐 Seguridad y Privacidad

### Identificación por Session ID
- **UUID único** por sesión (no IP)
- **Más seguro** para usuarios
- **Configurable** por aplicación

### Manejo de Datos
- **IP almacenada** solo para analytics (opcional)
- **Contenido encriptado** en tránsito
- **Archivado automático** de conversaciones antigas

## 📈 Monitoreo

### Métricas Principales
- Tiempo de respuesta promedio
- Número de conversaciones activas
- Chunks más utilizados
- Calidad de respuestas (scores de confianza)

### Logs Estructurados
```javascript
console.log(`🤔 Processing question: "${question}" (${language}) [Session: ${sessionId}]`);
console.log(`✅ Response generated in ${processingTime}ms with ${confidence} confidence`);
```

## 🚨 Troubleshooting

### Error de Conexión PostgreSQL
```bash
# Verificar conexión
psql -h localhost -U postgres -d handit_ai -c "SELECT NOW();"

# Verificar variables de entorno
echo $DB_HOST $DB_PORT $DB_NAME
```

### Reiniciar Migraciones
```bash
# Eliminar tabla de migraciones
DROP TABLE IF EXISTS migrations;

# Ejecutar migraciones nuevamente
npm run db:migrate
```

### Limpiar Cache de Conversaciones
```sql
-- Eliminar conversaciones de prueba
DELETE FROM conversations WHERE session_id LIKE 'test-%';
```

## 🎯 Próximos Pasos

1. **Implementar rate limiting** por sesión
2. **Exportar conversaciones** a diferentes formatos
3. **Notificaciones** de conversaciones largas
4. **Resumén automático** de conversaciones
5. **Integración con Handit.ai** para feedback

¡El sistema está listo para producción! 🚀 