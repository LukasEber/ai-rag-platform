# Database Migrations

## Excel SQLite Migration

### Migration: `add_excel_sqlite.sql`

**Date**: 2024-12-19  
**Purpose**: Add Excel SQLite table for intelligent Excel processing

**To execute this migration:**

1. **Using psql**:
   ```bash
   psql -d your_database_name -f lib/db/migrations/add_excel_sqlite.sql
   ```

2. **Using a database management tool**:
   - Copy the contents of `add_excel_sqlite.sql`
   - Execute in your database management tool

3. **Using your application's migration system**:
   - If you have a migration runner, add this to your migration queue

**What this migration does**:
- Creates `ExcelSqlite` table to store Excel SQLite database information
- Adds indexes for better performance
- Sets up foreign key relationships to `Project` and `ContextFile` tables
- Adds documentation comments

**Verification**:
After running the migration, you can verify it worked by checking:
```sql
SELECT * FROM "ExcelSqlite" LIMIT 1;
```

**Rollback** (if needed):
```sql
DROP TABLE IF EXISTS "ExcelSqlite" CASCADE;
```
