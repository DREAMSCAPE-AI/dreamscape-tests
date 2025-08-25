// Script de génération de rapport de coverage unifié
const fs = require('fs');
const path = require('path');

function generateCoverageReport() {
  console.log('📊 Generating unified coverage report...');
  
  const coverageDir = path.join(__dirname, '../../coverage');
  const reportsDir = path.join(__dirname, '../../reports');
  
  // Créer les répertoires si nécessaire
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Services à analyser
  const services = [
    'ai-service',
    'auth-service', 
    'user-service',
    'payment-service',
    'voyage-service',
    'web-client',
    'panorama-service',
    'working'
  ];

  const coverageData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalServices: services.length,
      servicesTotalLines: 0,
      servicesCoveredLines: 0,
      overallCoverage: 0,
      services: {}
    },
    details: {},
    thresholds: {
      ai: { branches: 80, functions: 85, lines: 80, statements: 80 },
      auth: { branches: 90, functions: 90, lines: 90, statements: 90 },
      user: { branches: 85, functions: 85, lines: 85, statements: 85 },
      payment: { branches: 95, functions: 95, lines: 95, statements: 95 },
      voyage: { branches: 80, functions: 80, lines: 80, statements: 80 },
      web: { branches: 75, functions: 75, lines: 75, statements: 75 },
      panorama: { branches: 70, functions: 70, lines: 70, statements: 70 }
    }
  };

  // Analyser chaque service
  services.forEach(service => {
    const serviceCoverageFile = path.join(coverageDir, service, 'coverage-summary.json');
    
    if (fs.existsSync(serviceCoverageFile)) {
      try {
        const serviceCoverage = JSON.parse(fs.readFileSync(serviceCoverageFile, 'utf8'));
        
        // Extraire les métriques globales
        const total = serviceCoverage.total || {};
        
        coverageData.details[service] = {
          lines: {
            total: total.lines?.total || 0,
            covered: total.lines?.covered || 0,
            pct: total.lines?.pct || 0
          },
          statements: {
            total: total.statements?.total || 0,
            covered: total.statements?.covered || 0,
            pct: total.statements?.pct || 0
          },
          functions: {
            total: total.functions?.total || 0,
            covered: total.functions?.covered || 0,
            pct: total.functions?.pct || 0
          },
          branches: {
            total: total.branches?.total || 0,
            covered: total.branches?.covered || 0,
            pct: total.branches?.pct || 0
          },
          status: getServiceStatus(service, total, coverageData.thresholds)
        };

        // Accumuler pour le résumé global
        coverageData.summary.servicesTotalLines += total.lines?.total || 0;
        coverageData.summary.servicesCoveredLines += total.lines?.covered || 0;
        
      } catch (error) {
        console.warn(`⚠️ Could not parse coverage for ${service}:`, error.message);
        coverageData.details[service] = {
          error: 'Could not parse coverage data',
          status: 'error'
        };
      }
    } else {
      console.warn(`⚠️ No coverage data found for ${service}`);
      coverageData.details[service] = {
        error: 'No coverage data available',
        status: 'missing'
      };
    }
  });

  // Calculer la coverage globale
  if (coverageData.summary.servicesTotalLines > 0) {
    coverageData.summary.overallCoverage = Math.round(
      (coverageData.summary.servicesCoveredLines / coverageData.summary.servicesTotalLines) * 100
    );
  }

  // Compter les services par statut
  Object.values(coverageData.details).forEach(service => {
    const status = service.status || 'unknown';
    coverageData.summary.services[status] = (coverageData.summary.services[status] || 0) + 1;
  });

  // Générer les rapports
  generateJSONReport(coverageData, reportsDir);
  generateHTMLReport(coverageData, reportsDir);
  generateMarkdownReport(coverageData, reportsDir);
  
  console.log('✅ Coverage reports generated successfully!');
  console.log(`📊 Overall coverage: ${coverageData.summary.overallCoverage}%`);
  
  return coverageData;
}

function getServiceStatus(serviceName, coverage, thresholds) {
  const serviceKey = serviceName.replace('-service', '');
  const threshold = thresholds[serviceKey];
  
  if (!threshold || !coverage.lines) {
    return 'unknown';
  }
  
  const linesCoverage = coverage.lines.pct || 0;
  const functionsCoverage = coverage.functions.pct || 0;
  const branchesCoverage = coverage.branches.pct || 0;
  const statementsCoverage = coverage.statements.pct || 0;
  
  const meetsThresholds = 
    linesCoverage >= threshold.lines &&
    functionsCoverage >= threshold.functions &&
    branchesCoverage >= threshold.branches &&
    statementsCoverage >= threshold.statements;
    
  if (meetsThresholds) {
    return 'excellent';
  } else if (linesCoverage >= threshold.lines * 0.8) {
    return 'good';
  } else if (linesCoverage >= threshold.lines * 0.6) {
    return 'fair';
  } else {
    return 'poor';
  }
}

function generateJSONReport(data, reportsDir) {
  const reportPath = path.join(reportsDir, 'coverage-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));
  console.log(`📄 JSON report: ${reportPath}`);
}

function generateHTMLReport(data, reportsDir) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dreamscape Coverage Report</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f5f7fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; text-align: center; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
        .metric { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .metric h3 { margin: 0 0 0.5rem 0; font-size: 2.5rem; }
        .metric p { margin: 0; color: #666; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
        .service { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .service-header { padding: 1rem; border-bottom: 1px solid #eee; }
        .service-metrics { padding: 1rem; }
        .progress-bar { background: #eee; height: 8px; border-radius: 4px; margin: 0.5rem 0; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .excellent { background: #10b981; }
        .good { background: #3b82f6; }
        .fair { background: #f59e0b; }
        .poor { background: #ef4444; }
        .status-badge { padding: 0.25rem 0.5rem; border-radius: 4px; color: white; font-size: 0.8rem; }
        .timestamp { text-align: center; color: #666; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Dreamscape Coverage Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="container">
        <div class="summary">
            <div class="metric">
                <h3>${data.summary.overallCoverage}%</h3>
                <p>Overall Coverage</p>
            </div>
            <div class="metric">
                <h3>${data.summary.totalServices}</h3>
                <p>Services Analyzed</p>
            </div>
            <div class="metric">
                <h3>${data.summary.services.excellent || 0}</h3>
                <p>Excellent Coverage</p>
            </div>
            <div class="metric">
                <h3>${data.summary.servicesTotalLines.toLocaleString()}</h3>
                <p>Total Lines</p>
            </div>
        </div>
        
        <div class="services">
            ${Object.entries(data.details).map(([service, details]) => `
            <div class="service">
                <div class="service-header">
                    <h3>${service} <span class="status-badge ${details.status}">${details.status}</span></h3>
                </div>
                <div class="service-metrics">
                    ${details.error ? `<p style="color: #ef4444;">${details.error}</p>` : `
                    <div>
                        <strong>Lines:</strong> ${details.lines.pct}%
                        <div class="progress-bar">
                            <div class="progress-fill ${details.status}" style="width: ${details.lines.pct}%"></div>
                        </div>
                    </div>
                    <div>
                        <strong>Functions:</strong> ${details.functions.pct}%
                        <div class="progress-bar">
                            <div class="progress-fill ${details.status}" style="width: ${details.functions.pct}%"></div>
                        </div>
                    </div>
                    <div>
                        <strong>Branches:</strong> ${details.branches.pct}%
                        <div class="progress-bar">
                            <div class="progress-fill ${details.status}" style="width: ${details.branches.pct}%"></div>
                        </div>
                    </div>
                    `}
                </div>
            </div>
            `).join('')}
        </div>
        
        <div class="timestamp">
            <p>Report generated at ${new Date(data.timestamp).toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  
  const reportPath = path.join(reportsDir, 'coverage-report.html');
  fs.writeFileSync(reportPath, html);
  console.log(`🌐 HTML report: ${reportPath}`);
}

function generateMarkdownReport(data, reportsDir) {
  const markdown = `# 📊 Dreamscape Coverage Report

**Generated:** ${new Date(data.timestamp).toLocaleString()}

## 🎯 Summary

| Metric | Value |
|--------|--------|
| **Overall Coverage** | ${data.summary.overallCoverage}% |
| **Services Analyzed** | ${data.summary.totalServices} |
| **Total Lines** | ${data.summary.servicesTotalLines.toLocaleString()} |
| **Covered Lines** | ${data.summary.servicesCoveredLines.toLocaleString()} |

## 📈 Services Status

${Object.entries(data.details).map(([service, details]) => {
  if (details.error) {
    return `### ❌ ${service}\n**Error:** ${details.error}\n`;
  }
  
  const statusEmoji = {
    excellent: '🟢',
    good: '🔵', 
    fair: '🟡',
    poor: '🔴',
    unknown: '⚪'
  };
  
  return `### ${statusEmoji[details.status] || '⚪'} ${service}
**Status:** ${details.status}
- **Lines:** ${details.lines.pct}% (${details.lines.covered}/${details.lines.total})
- **Functions:** ${details.functions.pct}% (${details.functions.covered}/${details.functions.total})
- **Branches:** ${details.branches.pct}% (${details.branches.covered}/${details.branches.total})
- **Statements:** ${details.statements.pct}% (${details.statements.covered}/${details.statements.total})
`;
}).join('\n')}

## 🎯 Coverage Thresholds

| Service | Lines | Functions | Branches | Statements |
|---------|--------|-----------|----------|------------|
${Object.entries(data.thresholds).map(([service, thresholds]) => 
  `| ${service} | ${thresholds.lines}% | ${thresholds.functions}% | ${thresholds.branches}% | ${thresholds.statements}% |`
).join('\n')}

---
*Report generated automatically by Dreamscape test suite*`;

  const reportPath = path.join(reportsDir, 'coverage-summary.md');
  fs.writeFileSync(reportPath, markdown);
  console.log(`📝 Markdown report: ${reportPath}`);
}

if (require.main === module) {
  generateCoverageReport();
}

module.exports = { generateCoverageReport };