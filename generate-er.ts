import { DataSource } from 'typeorm';
import { dataSourceOptions } from './src/data-source';

async function generate() {
    try {
        const ds = new DataSource(dataSourceOptions);
        await ds.initialize();
        const metadatas = ds.entityMetadatas;
        let mermaid = 'erDiagram\n';
        for (const meta of metadatas) {
            mermaid += `  ${meta.tableName} {\n`;
            for (const col of meta.columns) {
                let type = typeof col.type === 'string' ? col.type : (col.type as any)?.name || 'Unknown';
                let keys = '';
                if (col.isPrimary) keys += ' PK';
                if (meta.relations.some(r => r.joinColumns.some(jc => jc.databaseName === col.databaseName))) keys += ' FK';
                mermaid += `    ${type.replace(/[^a-zA-Z0-9]/g, '')} ${col.databaseName} ${keys.trim()}\n`;
            }
            mermaid += `  }\n`;
            for (const rel of meta.relations) {
                if (rel.isOwning) {
                    let relStr = '}o--||';
                    if (rel.isOneToOne) relStr = '|o--||';
                    if (rel.isManyToMany) relStr = '}o--o{';
                    const inverseTableName = rel.inverseEntityMetadata ? rel.inverseEntityMetadata.tableName : (typeof rel.type === 'function' ? rel.type.name : rel.type) || 'Unknown';
                    mermaid += `  ${meta.tableName} ${relStr} ${inverseTableName} : "${rel.propertyName}"\n`;
                }
            }
        }
        const fs = require('fs');
        fs.writeFileSync('er-diagram.md', mermaid);
        console.log('ER Diagram generated successfully.');
        await ds.destroy();
    } catch (err) {
        console.error('ERROR:', err);
    }
}
generate();
