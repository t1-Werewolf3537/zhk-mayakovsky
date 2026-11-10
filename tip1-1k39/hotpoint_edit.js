const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE_PATH = path.join(__dirname, 'data.js');
const INDEX_FILE_PATH = path.join(__dirname, 'index.html');
const JS_FILE_PATH = path.join(__dirname, 'index.js');
const PANEL_FILE_PATH = path.join(__dirname, 'hotpoint_edit.html');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
};

function getCleanAppData() {
    if (!fs.existsSync(DATA_FILE_PATH)) throw new Error("Файл data.js не найден!");
    const content = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}') + 1;
    return JSON.parse(content.substring(start, end));
}

function findActualScene(appData, searchId) {
    if (!searchId) return null;
    let scene = appData.scenes.find(s => s.id === searchId);
    if (scene) return scene;
    const match = searchId.match(/\d+/);
    if (match) {
        scene = appData.scenes.find(s => s.id.startsWith(match[0] + '_') || s.id === match[0]);
        if (scene) return scene;
    }
    return appData.scenes.find(s => s.id.toLowerCase().includes(searchId.toLowerCase()));
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const parsedUrl = new URL(req.url, 'http://' + req.headers.host);

    if (req.method === 'GET' && parsedUrl.pathname === '/get-all-scenes-list') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(getCleanAppData().scenes.map(s => ({ id: s.id, name: s.name || s.id }))));
        } catch (e) { res.writeHead(500); res.end(e.message); }
        return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/get-scene-data') {
        try {
            const appData = getCleanAppData(), scene = findActualScene(appData, parsedUrl.searchParams.get('sceneId'));
            if (!scene) { res.writeHead(404); res.end('Сцена не найдена'); return; }
            const hps = (scene.linkHotspots || []).map(hp => { const ts = appData.scenes.find(s => s.id === hp.target); return { targetId: hp.target, targetName: ts ? (ts.name || hp.target) : hp.target, yaw: hp.yaw, pitch: hp.pitch }; });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ id: scene.id, name: scene.name || scene.id, hotspots: hps }));
        } catch (e) { res.writeHead(500); res.end(e.message); }
        return;
    }









    if (req.method === 'POST' && parsedUrl.pathname === '/save-hotspot') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { sourceSceneId, targetSceneId, yaw, pitch } = JSON.parse(body);
                const appData = getCleanAppData();
                
                // Находим исходную сцену, в которой нажал кнопку пользователь
                const mainScene = findActualScene(appData, sourceSceneId);
                if (!mainScene) { res.writeHead(404); res.end('Сцена не найдена'); return; }

                // Определяем базовые имена (без _REPAIR) для вычисления парности
                const isSourceRepair = mainScene.name.endsWith('_REPAIR');
                const baseSourceName = isSourceRepair ? mainScene.name.replace('_REPAIR', '') : mainScene.name;
                
                const targetScene = appData.scenes.find(s => s.id === targetSceneId);
                const isTargetRepair = targetScene ? targetScene.name.endsWith('_REPAIR') : false;
                const baseTargetName = targetScene ? (isTargetRepair ? targetScene.name.replace('_REPAIR', '') : targetScene.name) : '';

                // Массив сцен, в которые мы будем производить запись хотспота (оригинал + пара)
                const scenesToUpdate = appData.scenes.filter(s => {
                    return s.name === baseSourceName || s.name === baseSourceName + '_REPAIR';
                });

                scenesToUpdate.forEach(scene => {
                    if (!scene.linkHotspots) scene.linkHotspots = [];
                    
                    // Определяем, куда должен вести хотспот из ТЕКУЩЕЙ модификации сцены
                    let finalTargetId = targetSceneId;
                    
                    // Если текущая обновляемая сцена — REPAIR, то и вести она должна на REPAIR-модификацию цели
                    if (scene.name.endsWith('_REPAIR')) {
                        const repairTarget = appData.scenes.find(s => s.name === baseTargetName + '_REPAIR');
                        if (repairTarget) finalTargetId = repairTarget.id;
                    } else {
                        // Если обычная сцена — должна вести на обычную цель
                        const normalTarget = appData.scenes.find(s => s.name === baseTargetName);
                        if (normalTarget) finalTargetId = normalTarget.id;
                    }

                    scene.linkHotspots.push({
                        yaw: parseFloat(yaw),
                        pitch: parseFloat(pitch),
                        rotation: 0,
                        target: finalTargetId
                    });
                    console.log(`[Синхронизация] Хотспот добавлен в "${scene.name}" (ID: ${scene.id}) -> Target ID: ${finalTargetId}`);
                });

                fs.writeFileSync(DATA_FILE_PATH, 'var APP_DATA = ' + JSON.stringify(appData, null, 2) + ';', 'utf8');
                res.writeHead(200); res.end('OK');
            } catch (e) { res.writeHead(500); res.end(e.message); }
        });
        return;
    }









    // 👇 НАШ НОВЫЙ БЛОК УДАЛЕНИЯ ВСТАЛ СЮДA
    if (req.method === 'POST' && parsedUrl.pathname === '/delete-hotspot') {
        let body = ''; req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { sceneId, index } = JSON.parse(body);
                const appData = getCleanAppData();
                const currentScene = findActualScene(appData, sceneId);

                if (!currentScene) { res.writeHead(404); res.end('Scene not found'); return; }

                const isRepair = currentScene.name.endsWith('_REPAIR');
                const baseName = isRepair ? currentScene.name.replace('_REPAIR', '') : currentScene.name;

                // Находим обе сцены (обычную и ремонтную)
                const pairedScenes = appData.scenes.filter(s => s.name === baseName || s.name === baseName + '_REPAIR');

                pairedScenes.forEach(scene => {
                    if (scene.linkHotspots && scene.linkHotspots[index] !== undefined) {
                        console.log(`[Синхронное удаление] Удален хотспот из сцены: ${scene.name} (Индекс: ${index})`);
                        scene.linkHotspots.splice(index, 1);
                    }
                });

                fs.writeFileSync(DATA_FILE_PATH, 'var APP_DATA = ' + JSON.stringify(appData, null, 2) + ';', 'utf8');
                res.writeHead(200); res.end('Deleted');
            } catch (e) { res.writeHead(500); res.end(e.message); }
        });
        return;
    }


    // 👆 КОНЕЦ БЛОКА УДАЛЕНИЯ


    const filePath = path.join(__dirname, decodeURIComponent(parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname));
    const ext = path.extname(filePath).toLowerCase();

    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        if (filePath === INDEX_FILE_PATH) {
            let html = fs.readFileSync(filePath, 'utf8');
            let panelHtml = fs.existsSync(PANEL_FILE_PATH) ? fs.readFileSync(PANEL_FILE_PATH, 'utf8') : '';
            res.end(html.includes('</body>') ? html.replace('</body>', panelHtml + '\n</body>') : html + panelHtml);
        } else if (filePath === JS_FILE_PATH) {
            let js = fs.readFileSync(filePath, 'utf8');
            if (js.includes('window.viewer = viewer;')) {
                js = js.replace('window.viewer = viewer;', 'window.viewer = viewer; window.customMarzipanoViewer = viewer; setTimeout(function(){ if(window.customMarzipanoViewer && window.updateEditorSceneContext) window.customMarzipanoViewer.addEventListener("sceneChange", window.updateEditorSceneContext); }, 400);');
            }
            res.end(js);
        } else {
            res.end(fs.readFileSync(filePath));
        }
    } else { res.writeHead(404); res.end(); }
});

server.listen(PORT, () => {
    console.log('\n==================================================');
    console.log('Локальный 3D-Редактор запущен: http://localhost:' + PORT);
    console.log('==================================================\n');
});
