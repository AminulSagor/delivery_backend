const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('Delivery Backend API - By Role.postman_collection.json', 'utf8'));

    let adminFolder = null;
    for (const item of data.item) {
        if (item.name === '01. ADMIN APIs') {
            adminFolder = item;
            break;
        }
    }

    if (!adminFolder) {
        console.error("Could not find '01. ADMIN APIs' folder");
        process.exit(1);
    }

    let markdown = '# 01. ADMIN APIs Documentation\n\n';

    function parseItem(item, path = '') {
        if (item.item) {
            // It's a folder
            markdown += `## ${path}${item.name}\n\n`;
            if (item.description) {
                markdown += `${item.description}\n\n`;
            }
            for (const subItem of item.item) {
                parseItem(subItem, path + item.name + ' > ');
            }
        } else {
            // It's a request
            markdown += `### ${item.name}\n\n`;
            
            if (item.request) {
                const req = item.request;
                markdown += `**Method:** \`${req.method}\`\n\n`;
                
                let urlRaw = '';
                if (typeof req.url === 'string') {
                    urlRaw = req.url;
                } else if (req.url && req.url.raw) {
                    urlRaw = req.url.raw;
                }
                markdown += `**Endpoint:** \`${urlRaw}\`\n\n`;

                if (req.description) {
                    markdown += `**Description:** ${req.description}\n\n`;
                }

                // Headers
                if (req.header && req.header.length > 0) {
                    markdown += `**Headers:**\n`;
                    markdown += `| Key | Value | Description |\n`;
                    markdown += `|---|---|---|\n`;
                    for (const h of req.header) {
                        const key = h.key ? h.key.replace(/\|/g, '\\|') : '';
                        const val = h.value ? h.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        const desc = h.description ? h.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        markdown += `| ${key} | ${val} | ${desc} |\n`;
                    }
                    markdown += `\n`;
                }

                // Query Params (Filters)
                if (req.url && req.url.query && req.url.query.length > 0) {
                    markdown += `**Query Parameters (Filters):**\n`;
                    markdown += `| Key | Value | Description |\n`;
                    markdown += `|---|---|---|\n`;
                    for (const q of req.url.query) {
                        const key = q.key ? q.key.replace(/\|/g, '\\|') : '';
                        const val = q.value ? q.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        const desc = q.description ? q.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        markdown += `| ${key} | ${val} | ${desc} |\n`;
                    }
                    markdown += `\n`;
                }

                // Path Variables
                if (req.url && req.url.variable && req.url.variable.length > 0) {
                    markdown += `**Path Variables:**\n`;
                    markdown += `| Key | Value | Description |\n`;
                    markdown += `|---|---|---|\n`;
                    for (const v of req.url.variable) {
                        const key = v.key ? v.key.replace(/\|/g, '\\|') : '';
                        const val = v.value ? v.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        const desc = v.description ? v.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                        markdown += `| ${key} | ${val} | ${desc} |\n`;
                    }
                    markdown += `\n`;
                }

                // Body
                if (req.body && req.body.mode) {
                    markdown += `**Request Body (${req.body.mode}):**\n\n`;
                    if (req.body.mode === 'raw') {
                        let bodyStr = req.body.raw;
                        try {
                            const jsonBody = JSON.parse(bodyStr);
                            bodyStr = JSON.stringify(jsonBody, null, 2);
                        } catch (e) {}
                        markdown += `\`\`\`json\n${bodyStr}\n\`\`\`\n\n`;
                    } else if (req.body.mode === 'formdata') {
                        markdown += `| Key | Type | Value | Description |\n`;
                        markdown += `|---|---|---|---|\n`;
                        for (const fd of req.body.formdata) {
                             const key = fd.key ? fd.key.replace(/\|/g, '\\|') : '';
                             const type = fd.type ? fd.type.replace(/\|/g, '\\|') : '';
                             const val = fd.value ? fd.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') : (fd.src ? fd.src.toString() : '');
                             const desc = fd.description ? fd.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                             markdown += `| ${key} | ${type} | ${val} | ${desc} |\n`;
                        }
                        markdown += `\n`;
                    } else if (req.body.mode === 'urlencoded') {
                        markdown += `| Key | Value | Description |\n`;
                        markdown += `|---|---|---|\n`;
                        for (const ue of req.body.urlencoded) {
                             const key = ue.key ? ue.key.replace(/\|/g, '\\|') : '';
                             const val = ue.value ? ue.value.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                             const desc = ue.description ? ue.description.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                             markdown += `| ${key} | ${val} | ${desc} |\n`;
                        }
                        markdown += `\n`;
                    }
                }
            }
            
            // Responses
            if (item.response && item.response.length > 0) {
                markdown += `**Example Responses:**\n\n`;
                for (const res of item.response) {
                    markdown += `#### ${res.name} (Status: ${res.code} ${res.status})\n\n`;
                    if (res.body) {
                        let bodyStr = res.body;
                        try {
                            const jsonBody = JSON.parse(bodyStr);
                            bodyStr = JSON.stringify(jsonBody, null, 2);
                        } catch (e) {}
                        markdown += `\`\`\`json\n${bodyStr}\n\`\`\`\n\n`;
                    }
                }
            }
            
            markdown += `---\n\n`;
        }
    }

    for (const subItem of adminFolder.item) {
        parseItem(subItem);
    }

    fs.writeFileSync('ADMIN_API_DOCS.md', markdown);
    console.log('Documentation generated successfully at ADMIN_API_DOCS.md');
} catch (error) {
    console.error('Error generating documentation:', error);
}
