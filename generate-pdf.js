const markdownpdf = require('markdown-pdf');
const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'API_ENDPOINTS_DOCUMENTATION.md');
const outputFile = path.join(__dirname, 'API_ENDPOINTS_DOCUMENTATION.pdf');

console.log('🚀 Starting PDF generation...');
console.log('📄 Input:', inputFile);
console.log('💾 Output:', outputFile);

const options = {
  cssPath: null,
  paperFormat: 'A4',
  paperOrientation: 'portrait',
  paperBorder: '2cm',
  remarkable: {
    html: true,
    breaks: true,
    plugins: [],
    syntax: ['footnote', 'sup', 'sub']
  }
};

markdownpdf(options)
  .from(inputFile)
  .to(outputFile, function () {
    console.log('✅ PDF generated successfully!');
    console.log('📍 Location:', outputFile);
    console.log('');
    console.log('📊 Document includes:');
    console.log('   • 21 API endpoints with full documentation');
    console.log('   • Database schema and ER diagrams');
    console.log('   • Authentication & authorization details');
    console.log('   • Email & SMS notification systems');
    console.log('   • Error handling and security info');
    console.log('   • Environment configuration guide');
    console.log('');
    console.log('🎉 Ready to use!');
  });
