/*!
 * ============================================================================
 * WolfTour Engine — Основная логика виртуального тура
 * © 2026 Wolf Studio (https://wolf-studio.ru) | Кирилл Бахарев. Все права защищены.
 *
 * ВНИМАНИЕ: Данный программный код является интеллектуальной собственностью
 * правообладателя. Запрещено копировать, модифицировать, распространять,
 * декомпилировать или размещать данный код и его части на любых сайтах
 * и серверах без предварительного письменного согласия автора.
 * Незаконное использование преследуется по закону (ст. 1259, 1301 ГК РФ).
 * ============================================================================
 */
'use strict';

(function() {
  var COPYRIGHT_NOTICE = '© 2026 Wolf Studio (https://wolf-studio.ru) | Кирилл Бахарев. Все права защищены. Использование, копирование и размещение кода на сторонних сайтах без письменного согласия правообладателя запрещены.';
  try {
    Object.defineProperty(window, 'WOLFTOUR_COPYRIGHT', {
      value: COPYRIGHT_NOTICE,
      writable: false,
      configurable: false
    });
    if (typeof console !== 'undefined' && console.log) {
      console.log(
        '%c WolfTour Engine %c ' + COPYRIGHT_NOTICE,
        'background:#007bff;color:#fff;font-weight:bold;padding:3px 6px;border-radius:3px;',
        'color:#9aa5b1;padding:3px 0;'
      );
    }
  } catch (e) {}

  var WolfTour = window.WolfTour;
  var data = window.APP_DATA;

  // =========================================================================
  // ГЛАВНЫЕ НАСТРОЙКИ ПРОЕКТА
  // =========================================================================
  var ENABLE_REPAIR_SWITCH = true; // true = тумблер отделки включен, false = полностью скрыт
  var ENABLE_MINIMAP = true;        // true = планировка включена, false = полностью скрыта
  var ENABLE_FULLSCREEN = false;    // true = кнопка полноэкранного режима включена, false = скрыта
  var ENABLE_GYROSCOPE = true;     // true = кнопка гироскопа включена на мобильных, false = скрыта
  var ENABLE_DEMO_WATERMARK = false; // true = тестовая сетка поверх панорамы (для демо заказчику)
  var SMART_SCROLL = true;          // true = умный скролл в iframe (зум после клика или с Ctrl)
  var START_WITH_REPAIR = false;    // true = старт с ремонтом (_REPAIR), false = без ремонта
  var START_SCENE_INDEX = 2;        // Индекс стартовой сцены (нумерация с 0)
  var KEEP_VIEW_ANGLE = true;       // true = смотреть по ходу движения, false = стартовый ракурс сцены (initialViewParameters)
  var APARTMENT_TITLE = "1-КОМНАТНАЯ | 39м²";
  var TILES_URL = "tiles";          // Путь к тайлам: "tiles" или ссылка на Яндекс Облако (без слеша на конце)
  var CAMERA_DRAG_SPEED = 0.65;     // Скорость вращения камеры (0.3 - плавно, 1.0 - стандарт)
  var CAMERA_INERTIA = 4.5;         // Затухание инерции (2.0 - длинный докат, 8.0 - быстрая остановка)
  var RADAR_ANGLE_OFFSET = 180;     // Базовый угол поворота луча радара (0 - 360 градусов)
  // =========================================================================

  var isWhiteStyle = Boolean(START_WITH_REPAIR);

  // Элементы DOM
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');

  // Определение десктопа или мобильного устройства
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    if (mql.addEventListener) {
      mql.addEventListener('change', setMode);
    } else if (mql.addListener) {
      mql.addListener(setMode);
    }
  } else {
    document.body.classList.add('desktop');
  }

  // Определение сенсорного экрана
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function onFirstTouch() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
    window.removeEventListener('touchstart', onFirstTouch);
  });

  // Определение запуска внутри iframe и инициализация вьюера WolfTour
  var isInIframe = false;
  try { isInIframe = window.self !== window.top; } catch (e) { isInIframe = true; }
  var useSmartScroll = SMART_SCROLL && isInIframe;

  var viewer = new WolfTour.Viewer(panoElement, {
    controls: {
      mouseViewMode: data.settings.mouseViewMode,
      dragSpeed: CAMERA_DRAG_SPEED,
      inertiaDamping: CAMERA_INERTIA,
      scrollLocked: useSmartScroll
    }
  });
  window.viewer = viewer;

  // Умный скролл в iframe и защита от прокрутки страницы при тач-жестах
  if (useSmartScroll) {
    var scrollHintEl = document.getElementById('iframe-scroll-hint');
    var scrollHintTimer = null;
    viewer.addEventListener('scrollBlocked', function() {
      if (!scrollHintEl) return;
      scrollHintEl.classList.add('is-visible');
      clearTimeout(scrollHintTimer);
      scrollHintTimer = setTimeout(function() {
        scrollHintEl.classList.remove('is-visible');
      }, 1800);
    });
    var unlockScroll = function() {
      viewer.setScrollLocked(false);
      if (scrollHintEl) scrollHintEl.classList.remove('is-visible');
    };
    panoElement.addEventListener('pointerdown', unlockScroll);
    window.addEventListener('blur', function() {
      viewer.setScrollLocked(true);
    });
  }
  panoElement.addEventListener('touchmove', function(e) {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });


  // Создание сцен (preview.jpg грузится сразу только для стартовой сцены, остальные — в фоне)
  var scenes = data.scenes.map(function(sceneData, idx) {
    var urlPrefix = TILES_URL.replace(/\/+$/, '');
    var ext = (data.settings && data.settings.tileFormat) ? data.settings.tileFormat : "jpg";
    var source = WolfTour.ImageUrlSource.fromString(
      urlPrefix + "/" + sceneData.id + "/{z}/{f}/{y}/{x}." + ext,
      { cubeMapPreviewUrl: urlPrefix + "/" + sceneData.id + "/preview." + ext }
    );

    var geometry = new WolfTour.CubeGeometry(sceneData.levels);

    var limiter = WolfTour.RectilinearView.limit.traditional(
      sceneData.faceSize * 2,
      125 * Math.PI / 180,
      140 * Math.PI / 180
    );

    var view = new WolfTour.RectilinearView(sceneData.initialViewParameters, limiter);

    var isInitial = (idx === START_SCENE_INDEX) || (idx === 0 && !data.scenes[START_SCENE_INDEX]);
    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: isInitial
    });

    if (!isInitial) {
      setTimeout(function() {
        var z0 = geometry.levelTiles(0);
        for (var k = 0; k < z0.length; k++) viewer._texMgr.get(scene._uid, source, z0[k]);
      }, 1200 + idx * 120);
    }

    // Создание стрелок перехода
    if (sceneData.linkHotspots) {
      sceneData.linkHotspots.forEach(function(hotspot) {
        var element = createLinkHotspotElement(hotspot);
        scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });
    }

    // Создание информационных значков
    if (sceneData.infoHotspots) {
      sceneData.infoHotspots.forEach(function(infoSpot) {
        var infoEl = createInfoHotspotElement(infoSpot);
        scene.hotspotContainer().createHotspot(infoEl, { yaw: infoSpot.yaw, pitch: infoSpot.pitch });
      });
    }

    return {
      data: sceneData,
      scene: scene,
      view: view
    };
  });
  // Меню списка квартир
  if (sceneListToggleElement && sceneListElement) {
    sceneListToggleElement.addEventListener('click', function() {
      sceneListElement.classList.toggle('enabled');
      sceneListToggleElement.classList.toggle('enabled');
    });
  }

  function hideSceneList() {
    if (sceneListElement) sceneListElement.classList.remove('enabled');
    if (sceneListToggleElement) sceneListToggleElement.classList.remove('enabled');
  }

  // Поиск парной сцены (с ремонтом или без)
  function resolveSceneVariant(scene) {
    if (!scene) return scene;

    var currentName = scene.data.name;
    var targetName = null;

    if (isWhiteStyle && !currentName.endsWith('_REPAIR')) {
      targetName = currentName + '_REPAIR';
    } else if (!isWhiteStyle && currentName.endsWith('_REPAIR')) {
      targetName = currentName.replace('_REPAIR', '');
    }

    if (targetName) {
      for (var i = 0; i < scenes.length; i++) {
        if (scenes[i].data.name === targetName) {
          return scenes[i];
        }
      }
    }

    return scene;
  }

  // Переключение сцен
  function switchScene(scene, keepViewAngle) {
    if (!scene) return;

    var finalScene = resolveSceneVariant(scene);
    var currentView = viewer.view();

    if (keepViewAngle && currentView && finalScene.view) {
      finalScene.view.setParameters({
        yaw: currentView.yaw(),
        pitch: currentView.pitch(),
        fov: currentView.fov()
      });
    } else if (!keepViewAngle && finalScene.data && finalScene.data.initialViewParameters && finalScene.view) {
      finalScene.view.setParameters(finalScene.data.initialViewParameters);
    }

    finalScene.scene.switchTo();
    syncRadarAngle(finalScene.view);

    if (sceneNameElement) {
      sceneNameElement.textContent = APARTMENT_TITLE;
    }

    // Перенос красной точки на мини-карте
    var mapDot = document.getElementById('mini-map-dot');
    if (mapDot && finalScene.data && finalScene.data.mapCoords) {
      mapDot.classList.add('switching');
      setTimeout(function() {
        mapDot.style.left = finalScene.data.mapCoords.left;
        mapDot.style.top = finalScene.data.mapCoords.top;
      }, 150);
      setTimeout(function() {
        mapDot.classList.remove('switching');
      }, 300);
    }
  }

  // Генерация синих точек комнат на мини-карте (исключая дубли _REPAIR)
  var pointsContainer = document.getElementById('mini-map-points');
  if (pointsContainer && data.scenes) {
    data.scenes.forEach(function(sceneData) {
      if (sceneData.name && sceneData.name.endsWith('_REPAIR')) {
        return;
      }

      if (sceneData.mapCoords && sceneData.mapCoords.left && sceneData.mapCoords.top) {
        var pointEl = document.createElement('div');
        pointEl.classList.add('map-nav-point');
        pointEl.setAttribute('data-scene-id', sceneData.id);
        pointEl.style.left = sceneData.mapCoords.left;
        pointEl.style.top = sceneData.mapCoords.top;

        pointEl.addEventListener('click', function(event) {
          event.stopPropagation();
          var targetScene = findSceneById(sceneData.id);
          if (targetScene) {
            switchScene(targetScene, KEEP_VIEW_ANGLE);
          }
        });

        pointsContainer.appendChild(pointEl);
      }
    });
  }

  // Создание элемента стрелки перехода
  function createLinkHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');

    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    icon.style.transform = 'rotate(' + hotspot.rotation + 'rad)';

    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target), KEEP_VIEW_ANGLE);
    });

    stopTouchAndScrollEventPropagation(wrapper);
    wrapper.appendChild(icon);

    return wrapper;
  }

  // Создание элемента информационного значка
  function createInfoHotspotElement(spot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'info-hotspot');

    var icon = document.createElement('img');
    icon.src = spot.icon || 'img/info.png';
    icon.alt = spot.title || 'Информация';
    icon.classList.add('info-hotspot-icon');
    wrapper.appendChild(icon);

    if (spot.openMode === 'link') {
      if (spot.title) {
        var tag = document.createElement('div');
        tag.classList.add('info-hotspot-tag');
        tag.textContent = spot.title;
        wrapper.appendChild(tag);
      }
      wrapper.addEventListener('click', function(e) {
        e.stopPropagation();
        if (spot.url) window.open(spot.url, '_blank', 'noopener,noreferrer');
      });
    } else {
      var card = document.createElement('div');
      card.classList.add('info-hotspot-card');

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.classList.add('info-hotspot-close');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        wrapper.classList.remove('is-open');
      });
      card.appendChild(closeBtn);

      if (spot.title) {
        var titleEl = document.createElement('div');
        titleEl.classList.add('info-hotspot-title');
        titleEl.textContent = spot.title;
        card.appendChild(titleEl);
      }
      if (spot.text) {
        var textEl = document.createElement('div');
        textEl.classList.add('info-hotspot-text');
        textEl.textContent = spot.text;
        card.appendChild(textEl);
      }
      if (spot.url) {
        var linkEl = document.createElement('a');
        linkEl.href = spot.url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.classList.add('info-hotspot-btn');
        linkEl.textContent = spot.linkText || 'Подробнее';
        card.appendChild(linkEl);
      }

      wrapper.appendChild(card);

      icon.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = wrapper.classList.contains('is-open');
        document.querySelectorAll('.info-hotspot.is-open').forEach(function(el) {
          el.classList.remove('is-open');
        });
        if (!wasOpen) wrapper.classList.add('is-open');
      });
    }

    stopTouchAndScrollEventPropagation(wrapper);
    return wrapper;
  }

  function stopTouchAndScrollEventPropagation(element) {
    var eventList = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel'];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      }, { passive: true });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }
  // Запуск стартовой сцены с проверкой границ массива
  var baseStartScene = scenes[START_SCENE_INDEX] || scenes[0];
  var startScene = resolveSceneVariant(baseStartScene);

  if (startScene) {
    startScene.scene.switchTo();
    if (sceneNameElement) {
      sceneNameElement.textContent = APARTMENT_TITLE;
    }

    var initialMapDot = document.getElementById('mini-map-dot');
    if (initialMapDot && startScene.data && startScene.data.mapCoords) {
      initialMapDot.style.left = startScene.data.mapCoords.left;
      initialMapDot.style.top = startScene.data.mapCoords.top;
    }
  }
  hideSceneList();

  // Логика тумблера "Вариант отделки" и подсказки
  var switchWrapper = document.querySelector('.ios-switch-wrapper');
  var finishToggleInput = document.getElementById('finish-variant-toggle-btn');
  var mapImageEl = document.getElementById('mini-map-img');
  var hintBox = document.getElementById('finish-variant-hint');

  if (!ENABLE_REPAIR_SWITCH) {
    if (switchWrapper) switchWrapper.style.display = 'none';
    if (mapImageEl) mapImageEl.src = 'img/plan.jpg';
  } else {
    var syncInterfaceStyle = function() {
      if (!finishToggleInput) return;
      finishToggleInput.checked = isWhiteStyle;
      if (mapImageEl) {
        mapImageEl.src = isWhiteStyle ? 'img/plan_REPAIR.jpg' : 'img/plan.jpg';
      }
    };

    syncInterfaceStyle();

    if (finishToggleInput) {
      var showTimer = null;

      if (hintBox) {
        showTimer = setTimeout(function() {
          if (!finishToggleInput.checked && !hintBox.classList.contains('is-dismissed')) {
            hintBox.classList.add('is-visible');
          }
        }, 6000);
      }

      finishToggleInput.addEventListener('change', function(event) {
        event.stopPropagation();

        isWhiteStyle = this.checked;

        if (isWhiteStyle && hintBox) {
          clearTimeout(showTimer);
          hintBox.classList.remove('is-visible');
          hintBox.classList.add('is-dismissed');
        }

        syncInterfaceStyle();

        var currentScene = viewer.scene();
        if (currentScene) {
          for (var i = 0; i < scenes.length; i++) {
            if (scenes[i].scene === currentScene) {
              switchScene(scenes[i], true);
              break;
            }
          }
        }
      });
    }
  }

  // Вращение луча радара на мини-карте
  function syncRadarAngle(viewObj) {
    var mapDot = document.getElementById('mini-map-dot');
    if (!mapDot || !viewObj) return;
    var degrees = viewObj.yaw() * (180 / Math.PI);
    mapDot.style.transform = 'translate(-50%, -50%) rotate(' + (degrees + RADAR_ANGLE_OFFSET) + 'deg)';
  }

  viewer.addEventListener('viewChange', function() {
    var currentScene = viewer.scene();
    if (currentScene) syncRadarAngle(currentScene.view());
  });

  if (startScene && startScene.view) {
    syncRadarAngle(startScene.view);
  }

  if (!ENABLE_MINIMAP) {
    var btnMap = document.getElementById('mini-map-toggle-btn');
    var wrapMap = document.getElementById('mini-map-wrapper');
    if (btnMap) btnMap.style.display = 'none';
    if (wrapMap) wrapMap.style.display = 'none';
  }

  // Сворачивание и разворачивание мини-карты
  var mapOpenBtn = document.getElementById('mini-map-toggle-btn');
  var mapWrapper = document.getElementById('mini-map-wrapper');
  var mapCloseBtn = document.getElementById('mini-map-close-btn');

  if (mapOpenBtn && mapWrapper && mapCloseBtn) {
    mapOpenBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      mapOpenBtn.classList.add('hidden-state');
      mapWrapper.classList.add('active-state');
    });

    mapCloseBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      mapWrapper.classList.remove('active-state');
      mapOpenBtn.classList.remove('hidden-state');
    });
  }

  // Полноэкранный режим (включается через ENABLE_FULLSCREEN в редакторе)
  var fsBtn = document.getElementById('fullscreen-toggle-btn');
  if (fsBtn) {
    if (!ENABLE_FULLSCREEN) {
      fsBtn.classList.add('is-hidden');
    } else {
      fsBtn.classList.remove('is-hidden');
      var isPseudoFs = false;
      var syncFsState = function() {
        var active = Boolean(document.fullscreenElement || document.webkitFullscreenElement || isPseudoFs);
        fsBtn.classList.toggle('is-fullscreen', active);
        fsBtn.title = active ? 'Свернуть из полного экрана' : 'На полный экран';
      };
      var togglePseudoFs = function(forceState) {
        isPseudoFs = typeof forceState === 'boolean' ? forceState : !isPseudoFs;
        syncFsState();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'wolftour:fullscreen', active: isPseudoFs }, '*');
        }
      };
      fsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var docEl = document.documentElement;
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
          var exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) exit.call(document).catch(function() { togglePseudoFs(false); });
        } else if (isPseudoFs) {
          togglePseudoFs(false);
        } else {
          var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
          if (req) {
            req.call(docEl).catch(function() { togglePseudoFs(true); });
          } else {
            togglePseudoFs(true);
          }
        }
      });
      document.addEventListener('fullscreenchange', syncFsState);
      document.addEventListener('webkitfullscreenchange', syncFsState);
    }
  }

  // Гироскоп с привязкой к точке старта (управляется через ENABLE_GYROSCOPE)
  var gyroBtn = document.getElementById('gyroscope-toggle-btn');
  if (gyroBtn) {
    var gyroSupported = WolfTour.GyroscopeController && WolfTour.GyroscopeController.isSupported();
    if (!ENABLE_GYROSCOPE || !gyroSupported) {
      gyroBtn.classList.add('is-hidden');
    } else {
      gyroBtn.classList.remove('is-hidden');
      var gyroCtrl = viewer.gyroscope();
      gyroCtrl.addEventListener('change', function(active) {
        gyroBtn.classList.toggle('is-active', active);
        gyroBtn.title = active ? 'Выключить гироскоп' : 'Управление гироскопом';
      });
      gyroBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        gyroCtrl.toggle().then(function(ok) {
          if (!ok) {
            alert('Разрешите доступ к датчикам движения в настройках браузера (работает только по HTTPS).');
          }
        });
      });
    }
  }

  // Тестовый водяной знак поверх панорамы (управляется через ENABLE_DEMO_WATERMARK)
  var demoLayer = document.getElementById('demo-watermark-overlay');
  if (!demoLayer && ENABLE_DEMO_WATERMARK) {
    demoLayer = document.createElement('div');
    demoLayer.id = 'demo-watermark-overlay';
    document.body.appendChild(demoLayer);
  }
  if (demoLayer) {
    if (!ENABLE_DEMO_WATERMARK) {
      demoLayer.style.display = 'none';
    } else {
      demoLayer.className = '';
      var cols = Math.max(2, Math.floor((window.innerWidth - 60) / 360));
      var rows = Math.max(3, Math.round((window.innerHeight - 60) / 190));
      var totalTiles = cols * rows;
      demoLayer.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;overflow:hidden;display:grid;grid-template-columns:repeat(' + cols + ',1fr);align-content:space-around;justify-items:center;padding:30px;';
      var tilesHtml = '';
      for (var w = 0; w < totalTiles; w++) {
        tilesHtml += '<div style="transform:rotate(-26deg);text-align:center;user-select:none;white-space:nowrap;">' +
          '<div style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-shadow:0 1px 3px rgba(0,0,0,0.45);">WOLF STUDIO</div>' +
          '<div style="font-family:Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:3px;color:rgba(255,255,255,0.35);text-shadow:0 1px 2px rgba(0,0,0,0.45);">ТЕСТОВЫЙ ПРОСМОТР</div>' +
          '</div>';
      }
      demoLayer.innerHTML = tilesHtml;
    }
  }

})();
