/**
 * Vosk 中文语音模型下载脚本
 *
 * 下载模型：vosk-model-small-cn-0.22 (~42MB)
 * 这是Vosk的中文小模型，适合桌面端离线使用。
 *
 * 其他可选模型：
 * - vosk-model-cn-0.22 (~1.3GB) 大模型，准确率更高
 * - vosk-model-small-cn-0.22 (~42MB) 小模型，速度快
 *
 * 用法: node scripts/download-model.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createWriteStream, existsSync, mkdirSync } = fs;

const MODELS_DIR = path.join(__dirname, '..', 'models');
const MODEL_NAME = 'vosk-model-small-cn-0.22';
const MODEL_URL = `https://alphacephei.com/vosk/models/${MODEL_NAME}.zip`;
const MODEL_CHECK = path.join(MODELS_DIR, MODEL_NAME, 'am');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return resolve(downloadFile(response.headers.location, destPath));
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastPercent = -1;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const percent = Math.round((downloaded / total) * 100);
          if (percent !== lastPercent) {
            lastPercent = percent;
            process.stdout.write(`\r  下载进度: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
          }
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n  下载完成!');
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      if (existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

function unzipFile(zipPath, outputDir) {
  return new Promise((resolve, reject) => {
    console.log('  解压中...');
    // Try using system unzip first
    const unzip = spawn('unzip', ['-o', zipPath, '-d', outputDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let lastLine = '';
    unzip.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      if (lines.length > 0) {
        lastLine = lines[lines.length - 1].trim();
      }
    });

    unzip.stderr.on('data', (data) => {
      // unzip outputs to stderr sometimes
    });

    unzip.on('close', (code) => {
      if (code === 0) {
        // Check for nested directory (zip contains MODEL_NAME/)
        const nestedPath = path.join(outputDir, MODEL_NAME);
        const targetPath = path.join(outputDir, MODEL_NAME.split('-').slice(0, -1).join('-'));

        // The zip extracts to a folder, check if it's already correct structure
        if (existsSync(path.join(nestedPath, 'am'))) {
          console.log('  解压完成!');
          try { fs.unlinkSync(zipPath); } catch (_) {}
          resolve();
        } else {
          // Try to find the model directory
          const items = fs.readdirSync(outputDir);
          const modelDir = items.find((i) => i.startsWith('vosk-model'));
          if (modelDir && existsSync(path.join(outputDir, modelDir, 'am'))) {
            if (modelDir !== MODEL_NAME) {
              fs.renameSync(path.join(outputDir, modelDir), nestedPath);
            }
            console.log('  解压完成!');
            try { fs.unlinkSync(zipPath); } catch (_) {}
            resolve();
          } else {
            // Try node's built-in zlib? No, need unzip.
            // Check if PowerShell is available (Windows)
            console.log('  尝试使用 PowerShell 解压...');
            resolve(extractWithPowerShell(zipPath, outputDir));
          }
        }
      } else {
        reject(new Error(`unzip exit code: ${code}`));
      }
    });

    unzip.on('error', (err) => {
      reject(err);
    });
  });
}

function extractWithPowerShell(zipPath, outputDir) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${outputDir}' -Force`,
    ], { stdio: 'pipe' });

    ps.on('close', (code) => {
      if (code === 0) {
        // The zip might extract to a subfolder
        const items = fs.readdirSync(outputDir);
        const modelDir = items.find((i) => i.startsWith('vosk-model'));
        if (modelDir && modelDir !== MODEL_NAME) {
          const src = path.join(outputDir, modelDir);
          const dst = path.join(outputDir, MODEL_NAME);
          if (!existsSync(dst)) {
            fs.renameSync(src, dst);
          }
        }
        console.log('  解压完成!');
        try { fs.unlinkSync(zipPath); } catch (_) {}
        resolve();
      } else {
        reject(new Error(`PowerShell Expand-Archive exit code: ${code}`));
      }
    });
  });
}

async function main() {
  console.log('=== Vosk 中文语音模型下载 ===\n');
  console.log(`模型: ${MODEL_NAME}`);
  console.log(`大小: ~42MB`);
  console.log(`目录: ${MODELS_DIR}\n`);

  // 检查模型是否已存在
  if (existsSync(MODEL_CHECK)) {
    console.log('✓ 模型已存在，跳过下载');
    console.log(`  路径: ${path.join(MODELS_DIR, MODEL_NAME)}`);
    return;
  }

  // 创建模型目录
  if (!existsSync(MODELS_DIR)) {
    mkdirSync(MODELS_DIR, { recursive: true });
  }

  const zipPath = path.join(MODELS_DIR, `${MODEL_NAME}.zip`);

  try {
    console.log('1. 开始下载模型...');
    await downloadFile(MODEL_URL, zipPath);
  } catch (err) {
    console.error(`\n✗ 下载失败: ${err.message}`);
    console.log('\n请手动下载:');
    console.log(`  ${MODEL_URL}`);
    console.log(`  然后解压到: ${path.join(MODELS_DIR, MODEL_NAME)}`);
    if (existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch (_) {}
    }
    process.exit(1);
  }

  try {
    console.log('\n2. 解压模型...');
    await unzipFile(zipPath, MODELS_DIR);
  } catch (err) {
    console.error(`\n✗ 解压失败: ${err.message}`);
    console.log(`  请手动解压 ${zipPath} 到 ${MODELS_DIR}`);
    process.exit(1);
  }

  // 验证
  if (existsSync(MODEL_CHECK)) {
    console.log('\n✓ 模型安装成功!');
  } else {
    console.log('\n⚠ 模型可能未正确解压');
    console.log(`  请检查 ${path.join(MODELS_DIR, MODEL_NAME)} 目录`);
  }

  console.log('\n提示: 如需更高准确率，可下载大模型 vosk-model-cn-0.22 (~1.3GB)');
  console.log('  下载地址: https://alphacephei.com/vosk/models/vosk-model-cn-0.22.zip');
}

main().catch(console.error);
