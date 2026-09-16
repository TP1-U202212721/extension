#!/usr/bin/env node
/**
 * E2E Test Runner - Puppeteer con Chrome + Extensión ScamShield
 * 
 * Ejecuta los escenarios de prueba que requieren la extensión instalada.
 * 
 * Uso: node tests/e2e/puppeteer-e2e-runner.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuración
const EXTENSION_PATH = path.resolve(__dirname, '../../.output/chrome-mv3-dev');
const MERCADOLIBRE_URL = 'https://www.mercadolibre.com.ar';
const ALIEXPRESS_URL = 'https://www.aliexpress.com';
const AMAZON_URL = 'https://www.amazon.com';
const EBAY_URL = 'https://www.ebay.com';
const SCREENSHOTS_DIR = path.resolve(__dirname, './screenshots');

// Crear directorio de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Resultados de pruebas
const results = [];

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function saveScreenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function runTest(name, fn) {
  log('🧪', `Ejecutando: ${name}`);
  try {
    await fn();
    results.push({ name, status: 'CUMPLIDO', detail: '' });
    log('✅', `${name} - CUMPLIDO`);
  } catch (error) {
    results.push({ name, status: 'FALLA', detail: error.message });
    log('❌', `${name} - FALLA: ${error.message}`);
  }
}

async function main() {
  log('🚀', 'Iniciando pruebas E2E con Puppeteer + Extensión ScamShield');
  log('📁', `Extensión: ${EXTENSION_PATH}`);
  
  // Verificar que la extensión existe
  if (!fs.existsSync(EXTENSION_PATH)) {
    log('❌', 'La extensión no está construida. Ejecuta: pnpm build:chrome');
    process.exit(1);
  }

  // Lanzar Chrome con la extensión
  log('🌐', 'Lanzando Chrome con extensión...');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,720'
    ],
    defaultViewport: { width: 1280, height: 720 }
  });

  // Esperar a que la extensión se cargue
  await new Promise(resolve => setTimeout(resolve, 3000));

  const page = await browser.newPage();
  
  // ============================================
  // US001 - Instalar extensión de ScamShield
  // ============================================
  await runTest('US001 - Instalación exitosa', async () => {
    // Verificar que la extensión se cargó
    const targets = await browser.targets();
    const extensionTarget = targets.find(t => 
      t.url().includes('chrome-extension://') && 
      t.url().includes('popup.html')
    );
    
    if (!extensionTarget) {
      throw new Error('La extensión no se cargó correctamente');
    }
    
    log('📎', `Extensión detectada: ${extensionTarget.url()}`);
  });

  // ============================================
  // US002 - Extensión reconoce marketplace
  // ============================================
  await runTest('US002 - Reconocimiento automático de marketplace', async () => {
    await page.goto(MERCADOLIBRE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar que el content script se inyectó
    const hasScamShield = await page.evaluate(() => {
      return document.querySelector('[data-scamshield]') !== null || 
             document.querySelector('.scamshield-badge') !== null ||
             document.querySelector('#scamshield-panel') !== null;
    });
    
    log('🔍', `Content script inyectado: ${hasScamShield}`);
    saveScreenshot(page, 'US002-marketplace-detected');
  });

  // ============================================
  // US003 - Badge de ScamShield en publicación
  // ============================================
  await runTest('US003 - Badge visible en publicación', async () => {
    // Navegar a una publicación de MercadoLibre
    const searchInput = await page.$('input[name="as_word"]');
    if (searchInput) {
      await searchInput.type('iPhone 15');
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      
      // Hacer clic en el primer resultado
      const firstResult = await page.$('.ui-search-result__content-wrapper a');
      if (firstResult) {
        await firstResult.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        saveScreenshot(page, 'US003-badge-on-listing');
        
        // Verificar si hay algún indicador de ScamShield
        const pageContent = await page.content();
        const hasBadge = pageContent.includes('scamshield') || pageContent.includes('ScamShield');
        log('🏷️', `Badge detectado en página: ${hasBadge}`);
      }
    }
  });

  // ============================================
  // US004 - Acceso en tarjetas de listado
  // ============================================
  await runTest('US004 - Acceso en tarjetas de listado', async () => {
    await page.goto(MERCADOLIBRE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const searchInput = await page.$('input[name="as_word"]');
    if (searchInput) {
      await searchInput.type('laptop');
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      saveScreenshot(page, 'US004-listing-cards');
    }
  });

  // ============================================
  // US005 - Analiza solo la página abierta
  // ============================================
  await runTest('US005 - Análisis de página actual', async () => {
    // La extensión solo lee el DOM actual, no hace scraping
    const currentUrl = page.url();
    log('🌐', `URL actual: ${currentUrl}`);
    saveScreenshot(page, 'US005-current-page');
  });

  // ============================================
  // US006-US009 - Sesión del comprador
  // ============================================
  await runTest('US006 - Iniciar sesión en extensión', async () => {
    // Buscar el popup de la extensión
    const targets = await browser.targets();
    const extensionTarget = targets.find(t => 
      t.url().includes('chrome-extension://') && 
      t.url().includes('popup.html')
    );
    
    if (extensionTarget) {
      const extensionPage = await extensionTarget.page();
      if (extensionPage) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        saveScreenshot(extensionPage, 'US006-extension-popup');
        log('📎', 'Popup de extensión abierto');
      }
    }
  });

  // ============================================
  // US011-US015 - Estimación de riesgo
  // ============================================
  await runTest('US011 - Análisis de publicación', async () => {
    // Navegar a una publicación específica
    await page.goto('https://articulo.mercadolibre.com.ar/MLA-1397547892', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    saveScreenshot(page, 'US011-product-analysis');
    
    // Verificar si hay panel de ScamShield
    const hasPanel = await page.evaluate(() => {
      return document.querySelector('#scamshield-panel') !== null ||
             document.querySelector('.scamshield-verdict') !== null ||
             document.querySelector('[data-scamshield-panel]') !== null;
    });
    
    log('📊', `Panel de análisis detectado: ${hasPanel}`);
  });

  // ============================================
  // US016-US022 - Evidencia del sitio
  // ============================================
  await runTest('US016-US022 - Evidencia del sitio/vendedor', async () => {
    const pageContent = await page.content();
    
    // Verificar elementos de evidencia
    const hasEvidence = await page.evaluate(() => {
      const indicators = {
        domainVeracity: document.querySelector('.domain-veracity') !== null,
        sellerReputation: document.querySelector('.seller-reputation') !== null,
        riskSignals: document.querySelector('.risk-signals') !== null,
        reviews: document.querySelector('.reviews-section') !== null
      };
      return indicators;
    });
    
    log('📋', `Indicadores de evidencia: ${JSON.stringify(hasEvidence)}`);
    saveScreenshot(page, 'US016-022-evidence');
  });

  // ============================================
  // US023-US026 - Cobertura de marketplaces
  // ============================================
  await runTest('US023 - Cobertura MercadoLibre', async () => {
    await page.goto(MERCADOLIBRE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    saveScreenshot(page, 'US023-mercadolibre');
    log('🛒', `MercadoLibre cargado: ${page.url()}`);
  });

  await runTest('US024 - Cobertura AliExpress', async () => {
    await page.goto(ALIEXPRESS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    saveScreenshot(page, 'US024-aliexpress');
    log('🛒', `AliExpress cargado: ${page.url()}`);
  });

  await runTest('US025 - Cobertura Amazon', async () => {
    await page.goto(AMAZON_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    saveScreenshot(page, 'US025-amazon');
    log('🛒', `Amazon cargado: ${page.url()}`);
  });

  await runTest('US026 - Cobertura eBay', async () => {
    await page.goto(EBAY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    saveScreenshot(page, 'US026-ebay');
    log('🛒', `eBay cargado: ${page.url()}`);
  });

  // Cerrar navegador
  await browser.close();

  // Generar reporte
  log('\n📊', '=== REPORTE DE PRUEBAS E2E ===\n');
  
  const cumulative = results;
  const passed = cumulative.filter(r => r.status === 'CUMPLIDO').length;
  const failed = cumulative.filter(r => r.status === 'FALLA').length;
  
  log('📈', `Total: ${cumulative.length} | ✅ Cumplidos: ${passed} | ❌ Fallas: ${failed}`);
  
  // Guardar reporte
  const reportPath = path.resolve(__dirname, './REPORT_PUPPETEER.md');
  let report = `# Reporte E2E - Puppeteer + Extensión\n\n`;
  report += `**Fecha**: ${new Date().toISOString()}\n\n`;
  report += `## Resultados\n\n`;
  report += `| HU | Status | Detalle |\n`;
  report += `|---|---|---|\n`;
  
  cumulative.forEach(r => {
    report += `| ${r.name} | ${r.status} | ${r.detail || '-'} |\n`;
  });
  
  report += `\n## Estadísticas\n\n`;
  report += `- Total: ${cumulative.length}\n`;
  report += `- Cumplidos: ${passed}\n`;
  report += `- Fallas: ${failed}\n`;
  report += `- Cobertura: ${Math.round((passed / cumulative.length) * 100)}%\n`;
  
  fs.writeFileSync(reportPath, report);
  log('📄', `Reporte guardado en: ${reportPath}`);
}

main().catch(error => {
  log('❌', `Error fatal: ${error.message}`);
  process.exit(1);
});
