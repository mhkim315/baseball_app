const fs = require('fs');
let code = fs.readFileSync('mobile/widgets/GameStatusWidget.tsx', 'utf-8');

// Fix alpha function
code = code.replace(
  'function alpha(hex: string, a: string): string {\n  return "#" + a + hex.slice(1);\n}',
  'function alpha(hex: string, a: string): string {\n  return hex + a;\n}'
);

// Helper to replace TextWidget props with style
code = code.replace(/<TextWidget([^>]+)\/>/g, (match, props) => {
  let styleObj = {};
  let newProps = props;
  
  // Extract fontSize
  const fsMatch = newProps.match(/fontSize={(\d+)}/);
  if (fsMatch) { styleObj.fontSize = fsMatch[1]; newProps = newProps.replace(fsMatch[0], ''); }
  
  // Extract fontWeight
  const fwMatch = newProps.match(/fontWeight="([^"]+)"/);
  if (fwMatch) { styleObj.fontWeight = '"' + fwMatch[1] + '"'; newProps = newProps.replace(fwMatch[0], ''); }
  
  // Extract textColor string
  const tcMatchStr = newProps.match(/textColor="([^"]+)"/);
  if (tcMatchStr) { styleObj.color = '"' + tcMatchStr[1] + '"'; newProps = newProps.replace(tcMatchStr[0], ''); }
  
  // Extract textColor expression
  const tcMatchExp = newProps.match(/textColor={([^}]+)}/);
  if (tcMatchExp) { styleObj.color = tcMatchExp[1]; newProps = newProps.replace(tcMatchExp[0], ''); }
  
  // Extract existing style
  let existingStyle = '';
  const styleMatch = newProps.match(/style={{([^}]+)}}/);
  if (styleMatch) { existingStyle = styleMatch[1]; newProps = newProps.replace(styleMatch[0], ''); }
  
  // Build new style string
  let styleProps = [];
  if (existingStyle) styleProps.push(existingStyle.trim());
  for (const [k, v] of Object.entries(styleObj)) {
    styleProps.push(`${k}: ${v}`);
  }
  
  if (styleProps.length > 0) {
    newProps += ` style={{ ${styleProps.join(', ')} }}`;
  }
  
  // Cleanup extra spaces
  newProps = newProps.replace(/\s+/g, ' ');
  
  return `<TextWidget${newProps}/>`;
});

// Replace ColorBg usage that was removed in main4x2View
code = code.replace(
  /<FlexWidget\s*style={{\s*width:\s*"match_parent",\s*height:\s*"match_parent",\s*backgroundColor:\s*bg,\s*borderRadius:\s*16\s*}}\s*clickAction="OPEN_APP"\s*>/,
  '<ColorBg bg={bg} borderRadius={16}>'
);

// Close the ColorBg tag at the end of main4x2View
code = code.replace(
  /\s*<\/FlexWidget>\s*<\/FlexWidget>\s*<\/FlexWidget>\s*\);\s*}/,
  '\n      </FlexWidget>\n    </ColorBg>\n  );\n}'
);

fs.writeFileSync('mobile/widgets/GameStatusWidget.tsx', code);
