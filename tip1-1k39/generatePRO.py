import os
import json
import math
import re
from PIL import Image

INPUT_DIR = "images"
OUTPUT_DIR = "tiles"
DATA_JS_PATH = "data.js"
TILE_SIZE = 512

def equirect_to_cube_face(img, face, face_size):
    cube_img = Image.new("RGB", (face_size, face_size))
    pixels = cube_img.load()
    src_pixels = img.load()
    src_width, src_height = img.size

    for i in range(face_size):
        for j in range(face_size):
            a = 2.0 * i / (face_size - 1) if face_size > 1 else 0
            b = 2.0 * j / (face_size - 1) if face_size > 1 else 0
            a -= 1.0
            b -= 1.0

            if face == 'r':   vx, vy, vz =  1.0,   b,  -a
            elif face == 'l': vx, vy, vz = -1.0,   b,   a
            elif face == 'u': vx, vy, vz =   a, -1.0,   b
            elif face == 'd': vx, vy, vz =   a,  1.0,  -b
            elif face == 'f': vx, vy, vz =   a,   b,   1.0
            elif face == 'b': vx, vy, vz =  -a,   b,  -1.0
            else: vx, vy, vz = 0, 0, 0

            phi = math.atan2(vx, vz)
            theta = math.atan2(vy, math.sqrt(vx*vx + vz*vz))

            ui = int((phi + math.pi) / (2.0 * math.pi) * src_width)
            vi = int((theta + math.pi / 2.0) / math.pi * src_height)

            ui = max(0, min(ui, src_width - 1))
            vi = max(0, min(vi, src_height - 1))

            pixels[i, j] = src_pixels[ui, vi]
    return cube_img

def create_vertical_cube_preview(faces_dict, face_size=256):
    faces_order = ['b', 'd', 'f', 'l', 'r', 'u']
    preview_img = Image.new("RGB", (face_size, face_size * 6))
    
    for idx, face in enumerate(faces_order):
        face_resized = faces_dict[face].resize((face_size, face_size), Image.Resampling.LANCZOS)
        preview_img.paste(face_resized, (0, idx * face_size))
        
    return preview_img

def process_panorama(img_path, scene_id):
    print(f"Обработка: {img_path}...")
    img = Image.open(img_path)
    
    scene_root_dir = os.path.join(OUTPUT_DIR, scene_id)
    os.makedirs(scene_root_dir, exist_ok=True)

    faces = ['b', 'd', 'f', 'l', 'r', 'u']
    max_face_size = 2048
    generated_faces = {}
    for face in faces:
        generated_faces[face] = equirect_to_cube_face(img, face, max_face_size)

    preview_img = create_vertical_cube_preview(generated_faces, face_size=256)
    preview_img.save(os.path.join(scene_root_dir, "preview.jpg"), "JPEG", quality=75)

    levels_config = [
        {"id": "1", "face_size": 512,  "tile_size": 512}, 
        {"id": "2", "face_size": 1024, "tile_size": 512}, 
        {"id": "3", "face_size": 2048, "tile_size": 512}  
    ]

    for lvl in levels_config:
        z_id = lvl["id"]
        f_size = lvl["face_size"]
        t_size = lvl["tile_size"]
        tiles_per_edge = f_size // t_size

        for face in faces:
            level_face_img = generated_faces[face].resize((f_size, f_size), Image.Resampling.LANCZOS)
            for y in range(tiles_per_edge):
                for x in range(tiles_per_edge):
                    box = (x * t_size, y * t_size, (x + 1) * t_size, (y + 1) * t_size)
                    tile = level_face_img.crop(box)
                    tile_dir = os.path.join(scene_root_dir, z_id, face, str(y))
                    os.makedirs(tile_dir, exist_ok=True)
                    tile.save(os.path.join(tile_dir, f"{x}.jpg"), "JPEG", quality=85)

def ask_confirm(prompt):
    while True:
        ans = input(f"{prompt} (y/n): ").strip().lower()
        if ans in ['y', 'yes', 'да', 'д']: return True
        if ans in ['n', 'no', 'нет', 'н']: return False

def load_existing_data_js():
    if not os.path.exists(DATA_JS_PATH): return None
    try:
        with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
            content = f.read().strip()
        match = re.search(r"var\s+APP_DATA\s*=\s*(\{.*\});", content, re.DOTALL)
        if match: return json.loads(match.group(1))
    except Exception as e:
        print(f"Предупреждение: Не удалось прочесть существующий data.js ({e})")
    return None

def rebuild_all_hotspots(scenes):
    # Очищено от автогенерации шаблонных стрелок, массивы создаются чистыми
    for scene in scenes:
        if "linkHotspots" not in scene:
            scene["linkHotspots"] = []
    return scenes

def build_scene_data(scene_id, pure_name):
    return {
        "id": scene_id,
        "name": pure_name,  
        "mapCoords": { "left": "50%", "top": "50%" },
        "levels": [
            { "tileSize": 256, "size": 256, "fallbackOnly": True },
            { "tileSize": 512, "size": 512 },
            { "tileSize": 512, "size": 1024 },
            { "tileSize": 512, "size": 2048 }
        ],
        "faceSize": 2048,
        "initialViewParameters": { "yaw": 0.0, "pitch": 0.0, "fov": 1.2 },
        "linkHotspots": [], 
        "infoHotspots": []
    }

def generate_tour():
    if not os.path.exists(INPUT_DIR):
        print(f"Ошибка: Создайте папку '{INPUT_DIR}' в корне проекта.")
        return

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    image_extensions = (".jpg", ".jpeg", ".png")
    
    images_in_folder = []
    for f in sorted(os.listdir(INPUT_DIR)):
        if f.lower().endswith(image_extensions):
            images_in_folder.append({
                "pure_name": os.path.splitext(f)[0],
                "filename": f
            })
    
    tiles_folders = []
    tour_data = load_existing_data_js()
    existing_scenes = tour_data["scenes"] if (tour_data and "scenes" in tour_data) else []

    for d in os.listdir(OUTPUT_DIR):
        if os.path.isdir(os.path.join(OUTPUT_DIR, d)):
            match = re.match(r"^(\d+)$", d)
            if match:
                clean_name = d
                if existing_scenes:
                    scene_match = next((s for s in existing_scenes if s["id"] == d), None)
                    if scene_match: clean_name = scene_match["name"]
                tiles_folders.append({
                    "full": d,
                    "index": int(match.group(1)),
                    "clean": clean_name
                })
    tiles_folders.sort(key=lambda x: x["index"])

    img_set = set(img["pure_name"] for img in images_in_folder)
    tile_set = set(t["clean"] for t in tiles_folders)

    slice_needed = False
    files_to_process = []
    is_incremental = False

    if not tiles_folders:
        if not images_in_folder:
            print(f"В папке '{INPUT_DIR}' не найдено картинок. Нечего нарезать.")
            return
        print(f"\nПапка '{OUTPUT_DIR}' пуста. Найдено файлов для нарезки: {len(images_in_folder)}")
        
        while True:
            choice = input("Нарезаем [все] тайлы или [выборочно]? (все/выборочно/отмена): ").strip().lower()
            if choice in ['все', 'в', 'all', 'a']:
                slice_needed = True
                for idx, img in enumerate(images_in_folder):
                    files_to_process.append({
                        "pure_name": img["pure_name"], 
                        "filename": img["filename"], 
                        "scene_id": f"{idx + 1}"
                    })
                existing_scenes = []
                break
            elif choice in ['выборочно', 'выбор', 's', 'select']:
                print("\nСписок картинок в папке /images:")
                for idx, img in enumerate(images_in_folder):
                    print(f" [{idx + 1}] {img['filename']}")
                
                user_input = input("\nУкажите номера картинок через запятую (напр.: 1, 3): ").strip()
                if user_input:
                    try:
                        chosen_indices = [int(x.strip()) - 1 for x in user_input.split(",") if x.strip().isdigit()]
                        chosen_indices = sorted(list(set(chosen_indices)))
                        
                        for new_idx, idx in enumerate(chosen_indices):
                            if 0 <= idx < len(images_in_folder):
                                img = images_in_folder[idx]
                                slice_needed = True
                                files_to_process.append({
                                    "pure_name": img["pure_name"], 
                                    "filename": img["filename"], 
                                    "scene_id": f"{new_idx + 1}" 
                                })
                        existing_scenes = []
                    except Exception as e:
                        print(f"Ошибка при разборе номеров: {e}. Нарезка отменена.")
                break
            elif choice in ['отмена', 'о', 'n', 'exit']:
                print("Нарезка отменена пользователем.")
                break

    elif not tile_set.issubset(img_set):
        print("\n[ИНФОРМАЦИЯ] В папке /tiles обнаружены папки, для которых нет исходных картинок в /images:")
        for t in tiles_folders:
            if t["clean"] not in img_set:
                print(f" - Существующая папка тайлов: '{t['full']}' (оригинальное имя: {t['clean']})")
        
        new_images_names = img_set - tile_set
        if new_images_names:
            print(f"\nПри этом найдены новые картинки в '{INPUT_DIR}' ({len(new_images_names)} шт.):")
            for n in sorted(new_images_names):
                print(f" + Новая панорама: {n}")
            if ask_confirm("\nНарезать новые картинки? (старые папки тайлов останутся без изменений)"):
                slice_needed = True
                is_incremental = True
                start_index = max([t["index"] for t in tiles_folders]) + 1
                new_files = [img for img in images_in_folder if img["pure_name"] in new_images_names]
                for idx, img in enumerate(new_files):
                    files_to_process.append({
                        "pure_name": img["pure_name"], 
                        "filename": img["filename"], 
                        "scene_id": f"{start_index + idx}"
                    })
        else:
            print("\nНовых картинок для дорезки в /images не обнаружено.")

    else:
        new_images_names = img_set - tile_set
        
        if img_set == tile_set:
            print(f"\n[СИНХРОНИЗАЦИЯ] Структура папок '{OUTPUT_DIR}' совпадает с файлами в '{INPUT_DIR}'.")
            print("Названия идентичны, изменений в структуре нет.")
        else:
            print(f"\n[СИНХРОНИЗАЦИЯ] Обнаружены изменения! Все старые файлы на месте, но есть новые.")
            print(f"Найдено новых картинок в '{INPUT_DIR}' ({len(new_images_names)} шт.):")
            for n in sorted(new_images_names):
                print(f" + Новая панорама: {n}")

        if new_images_names:
            if ask_confirm("\nНарезать новые картинки? (старые останутся без изменений)"):
                slice_needed = True
                is_incremental = True
                start_index = max([t["index"] for t in tiles_folders]) + 1
                new_files = [img for img in images_in_folder if img["pure_name"] in new_images_names]
                for idx, img in enumerate(new_files):
                    files_to_process.append({
                        "pure_name": img["pure_name"], 
                        "filename": img["filename"], 
                        "scene_id": f"{start_index + idx}"
                    })

    if tiles_folders:
        available_for_replace = [t for t in tiles_folders if t["clean"] in img_set]
        
        if available_for_replace:
            if ask_confirm("\nЖелаете переписать/обновить какие-то из доступных существующих панорам?"):
                print("\nСписок доступных для обновления сцен:")
                for idx, t in enumerate(available_for_replace):
                    print(f" [{idx + 1}] ID: {t['full']} (Имя: {t['clean']})")
                
                user_input = input("\nУкажите номера сцен через запятую (например: 1, 3): ").strip()
                if user_input:
                    try:
                        chosen_indices = [int(x.strip()) - 1 for x in user_input.split(",") if x.strip().isdigit()]
                        
                        for idx in chosen_indices:
                            if 0 <= idx < len(available_for_replace):
                                target_tile = available_for_replace[idx]
                                img_match = next((img for img in images_in_folder if img["pure_name"] == target_tile["clean"]), None)
                                if img_match:
                                    slice_needed = True
                                    is_incremental = True
                                    
                                    if not any(f["scene_id"] == target_tile["full"] for f in files_to_process):
                                        files_to_process.append({
                                            "pure_name": target_tile["clean"],
                                            "filename": img_match["filename"],
                                            "scene_id": target_tile["full"]
                                        })
                                        print(f" -> Добавлено в очередь на замену: ID {target_tile['full']}")
                    except Exception as e:
                        print(f"Ошибка при разборе номеров: {e}. Выборочное обновление пропущено.")

    if is_incremental and not existing_scenes:
        for t in tiles_folders:
            existing_scenes.append(build_scene_data(t["full"], t["clean"]))

    if slice_needed and files_to_process:
        processed_folders = []
        
        for item in files_to_process:
            img_path = os.path.join(INPUT_DIR, item["filename"])
            scene_id = item["scene_id"]
            pure_name = item["pure_name"]
            
            process_panorama(img_path, scene_id)
            if scene_id not in processed_folders:
                processed_folders.append(scene_id)
            
            existing_block = next((s for s in existing_scenes if s["id"] == scene_id), None)
            if existing_block:
                existing_block["name"] = pure_name
            else:
                existing_scenes.append(build_scene_data(scene_id, pure_name))

        print("\n=== ОТЧЕТ О НАРЕЗКЕ ТАЙЛОВ ===")
        print("Тайлы успешно обработаны!")
        print("Созданные/Обновленные папки панорам:")
        for folder in processed_folders:
            print(f" - {OUTPUT_DIR}/{folder}")
        print("==============================\n")

        def get_scene_index(scene):
            match = re.match(r"^(\d+)$", scene["id"])
            return int(match.group(1)) if match else 0
            
        existing_scenes.sort(key=get_scene_index)
        all_scenes = rebuild_all_hotspots(existing_scenes)

        write_data_js = False
        data_js_exists = os.path.exists(DATA_JS_PATH)

        if not data_js_exists:
            write_data_js = True
        else:
            prompt_text = (
                f"Файл '{DATA_JS_PATH}' уже существует. Обновить измененные/новые сцены в нем?" 
                if is_incremental else 
                f"Файл '{DATA_JS_PATH}' уже существует. Перезаписать его с нуля?"
            )
            if ask_confirm(prompt_text):
                write_data_js = True

        if write_data_js:
            data_js_content = {
                "scenes": all_scenes,
                "settings": {
                    "mouseViewMode": "drag",
                    "autorotateEnabled": False
                }
            }
            json_string = json.dumps(data_js_content, indent=2, ensure_ascii=False)
            with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
                f.write(f"var APP_DATA = {json_string};")
            print(f"Данные успешно обновлены в '{DATA_JS_PATH}'. Всего сцен в туре: {len(all_scenes)}.")
        else:
            print(f"Изменения в '{DATA_JS_PATH}' НЕ вносились.")
    else:
        print("\nНарезка не требовалась или выбор был отменен. Скрипт успешно завершил работу.")

if __name__ == "__main__":
    generate_tour()
