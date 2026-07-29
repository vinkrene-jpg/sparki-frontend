const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('artifacts/sparki/src/{pages,components/sparki}/**/*.tsx');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('w-full') && !content.includes('flex-1') && !content.includes('ds-actiebalk')) return;
  
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if ((line.includes('<DsButton') || line.includes('<Button') || line.includes('<button') || line.includes('ds-actiebalk')) && (line.includes('w-full') || line.includes('flex-1') || content.includes('ds-actiebalk'))) {
      // Just print out any file with ds-actiebalk or full-width buttons to investigate manually
    }
  });
});
