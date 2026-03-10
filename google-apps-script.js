/**
 * Google Apps Script para inicializar la estructura del Gestor de Cobros (FiscalCtl).
 * 
 * Instrucciones:
 * 1. Abre tu hoja de cálculo de Google Sheets.
 * 2. Ve a Extensiones > Apps Script.
 * 3. Borra cualquier código existente y pega este script.
 * 4. Guarda el proyecto con el nombre "FiscalCtl-Init".
 * 5. Recarga la página de tu Google Sheet.
 * 6. Aparecerá un nuevo menú llamado "📊 FiscalCtl". Haz clic en "Inicializar Estructura".
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 FiscalCtl')
      .addItem('Inicializar Estructura', 'initializeStructure')
      .addToUi();
}

function initializeStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // 1. Configurar Hoja de Pagos (Payments)
  let paymentsSheet = ss.getSheetByName('Payments');
  if (!paymentsSheet) {
    paymentsSheet = ss.insertSheet('Payments');
  }
  
  const paymentHeaders = [
    'Date', 
    'Store', 
    'Method', 
    'AmountOriginal', 
    'Currency', 
    'AmountUsd', 
    'Reference', 
    'Description', 
    'Rate'
  ];
  
  // Aplicar encabezados y estilo
  paymentsSheet.getRange(1, 1, 1, paymentHeaders.length).setValues([paymentHeaders]);
  paymentsSheet.getRange(1, 1, 1, paymentHeaders.length)
    .setBackground('#0a1128') // Color oscuro de la app
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  paymentsSheet.setFrozenRows(1);
  
  // 2. Configurar Hoja de Ajustes (Settings)
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
  }
  
  const settingsHeaders = ['Key', 'Value'];
  settingsSheet.getRange(1, 1, 1, settingsHeaders.length).setValues([settingsHeaders]);
  settingsSheet.getRange(1, 1, 1, settingsHeaders.length)
    .setBackground('#0a1128')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Verificar si ya existe la tasa de cambio, si no, agregar valor por defecto
  const data = settingsSheet.getDataRange().getValues();
  let rateExists = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'ExchangeRate') {
      rateExists = true;
      break;
    }
  }
  
  if (!rateExists) {
    settingsSheet.appendRow(['ExchangeRate', '36.50']);
  }
  
  settingsSheet.setFrozenRows(1);
  
  // Eliminar hojas vacías por defecto si existen y hay más de una hoja
  const sheets = ss.getSheets();
  if (sheets.length > 2) {
    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (name !== 'Payments' && name !== 'Settings' && name.startsWith('Hoja')) {
        try {
          ss.deleteSheet(sheet);
        } catch(e) {
          // Ignorar si no se puede borrar
        }
      }
    });
  }
  
  ui.alert('✅ Estructura inicializada con éxito.\n\nSe han creado las hojas "Payments" y "Settings" con sus respectivos encabezados y estilos.');
}
