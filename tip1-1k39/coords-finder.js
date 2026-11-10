const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE_PATH = path.join(__dirname, 'data.js');

// Функция безопасного чтения и разбора файла data.js
function getAppData() {
    if (!fs.existsSync(DATA_FILE_PATH)) {
        throw new Error(`Файл не найден по пути: ${DATA_FILE_PATH}`);
    }
    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    const jsonStart = fileContent.indexOf('{');
    const jsonEnd = fileContent.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("Неверный формат data.js. Ожидался 'var APP_DATA = {...};'");
    }
    return JSON.parse(fileContent.substring(jsonStart, jsonEnd));
}

const server = http.createServer((req, res) => {
    // Настройка CORS заголовков для связи с браузером
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // МАРШРУТ GET: Отдаем сцены вместе с их текущими координатами mapCoords
    if (req.method === 'GET' && req.url === '/get-scenes') {
        try {
            const appData = getAppData();
            const scenesList = appData.scenes.map(s => ({ 
                id: s.id, 
                name: s.name || s.id,
                mapCoords: s.mapCoords || null
            }));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(scenesList));
        } catch (error) {
            console.error("Ошибка получения сцен:", error.message);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(error.message);
        }
        return;
    }

    // МАРШРУТ POST: Бесшумное сохранение новых координат клика
    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsedBody = JSON.parse(body);
                const sceneId = parsedBody.sceneId;
                const coordinates = parsedBody.coordinates;

                const appData = getAppData();
                const scene = appData.scenes.find(s => s.id === sceneId);
                
                if (!scene) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(`Ошибка: Сцена с id "${sceneId}" не найдена.`);
                    return;
                }

                // Перезаписываем блок mapCoords
                if (coordinates && coordinates.left && coordinates.top) {
                    scene.mapCoords = {
                        left: coordinates.left,
                        top: coordinates.top
                    };
                } else {
                    throw new Error("Неверный формат координат от клиента.");
                }

                // Пересобираем структуру и записываем обратно в файл
                const updatedContent = `var APP_DATA = ${JSON.stringify(appData, null, 2)};`;
                fs.writeFileSync(DATA_FILE_PATH, updatedContent, 'utf8');

                console.log(`[Обновлено] Сцена: ${sceneId} -> left: ${coordinates.left}, top: ${coordinates.top}`);
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Координаты обновлены успешно!`);

            } catch (error) {
                console.error("Ошибка при сохранении:", error.message);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Внутренняя ошибка сервера: ' + error.message);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`Node.js сервер успешно запущен на порту ${PORT}`);
    console.log(`Используйтеcoords-finder.html для настройки карты!`);
    console.log(`==================================================\n`);
});
