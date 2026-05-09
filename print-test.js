const { printRawThermalTexts } = require('./printer.js')

async function main() {
  await printRawThermalTexts([
    'Petra Lata',
    'Heineken Lata',
    'Heineken Lata',
    'Suco Laranja'
  ])
}

main().catch(console.error)