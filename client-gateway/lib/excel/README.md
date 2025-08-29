# Excel SQL Integration

Diese Implementierung fügt intelligente Excel-Unterstützung zu deinem RAG-System hinzu, basierend auf dem SQL-basierten Ansatz aus dem Artikel.

## Features

### 🎯 Intelligenter Agent
- **Automatische Entscheidung**: Der Agent wählt selbst zwischen Excel SQL und Vector Search
- **Confidence Scoring**: Jede Entscheidung hat ein Konfidenz-Score (0-1)
- **Fallback-Mechanismen**: Automatischer Fallback wenn eine Methode fehlschlägt
- **Multi-Modal**: Kombiniert strukturierte Daten (SQL) mit semantischer Suche (Vector)

### 📊 Excel SQL Verarbeitung
- **Automatische Typ-Erkennung**: Erkennt SQLite-Typen aus Excel-Daten
- **Multi-Sheet Support**: Verarbeitet alle Sheets in einer Excel-Datei
- **Sichere SQL-Ausführung**: Nur SELECT-Statements, SQL-Injection-Schutz
- **Schema-Management**: Speichert Tabellen-Schema für LLM-Zugriff

### 🔒 Sicherheit
- **SQL-Injection-Schutz**: Whitelist-basierte Tabellen-Validierung
- **Read-Only Mode**: Nur SELECT-Operationen erlaubt
- **Automatische Limits**: Standard-LIMIT von 100/200 Zeilen
- **Statement-Chaining-Block**: Verhindert multiple SQL-Statements

## Architektur

```
Excel Upload → SQLite Conversion → Agent Decision → Context Generation → LLM Response
     ↓              ↓                    ↓              ↓              ↓
  Vector DB    Excel SQLite DB    Source Selection   Context Text   Final Answer
```

## Dateien

- `sqlite.ts` - Excel zu SQLite Konvertierung und SQL-Ausführung
- `llm-integration.ts` - LLM-Integration für SQL-Generierung
- `agent.ts` - Intelligenter Agent für Datenquellen-Entscheidung

## Verwendung

Der Agent wird automatisch in der Chat-Route verwendet:

```typescript
// Automatische Entscheidung und Ausführung
const agentResult = await intelligentDataAgent(userQuestion, projectId);
```

## Entscheidungskriterien

### Excel SQL wird bevorzugt für:
- Numerische Analysen (Count, Sum, Average, Percentage)
- Filterung und Sortierung
- Aggregationen und Gruppierung
- Datum/Zeit-Analysen
- Strukturierte Abfragen

### Vector Search wird bevorzugt für:
- Semantisches Verständnis
- Komplexe Interpretationen
- Multi-Source-Analysen
- Exploratorische Analysen
- "Warum/Wie"-Fragen

## Datenbank-Schema

Neue Tabelle `ExcelSqlite`:
```sql
CREATE TABLE "ExcelSqlite" (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES Project(id),
  contextFileId UUID REFERENCES ContextFile(id),
  dbPath TEXT NOT NULL,
  tables JSON NOT NULL, -- TableInfo[] als JSON
  fileName TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## Logging

Der Agent loggt alle Entscheidungen:
```
[Agent] Analyzing question: "How many employees are there?"
[Agent] Decision: excel-sql (confidence: 0.95)
[Agent] Reasoning: This question asks for numerical aggregation which Excel SQL handles best
[Chat] Agent used sql mode with metadata: {sqlQuery: "SELECT COUNT(*) FROM...", rowCount: 5}
```
