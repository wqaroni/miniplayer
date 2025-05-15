(function () {
  "use strict";

  // Función para inicializar el lienzo (canvas)
  function initCanvas(container) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("id", "visualizerCanvas");
    canvas.setAttribute("class", "visualizer-item");
    container.appendChild(canvas);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return canvas;
  }

  // Función para cambiar el lienzo según el tamaño del contenedor
  function resizeCanvas(canvas, container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  // Visualizer
  const visualizer = (audio, container) => {
    if (!audio || !container) {
      return;
    }
    const options = {
      fftSize: container.dataset.fftSize || 2048,
      numBars: container.dataset.bars || 120,
      maxHeight: container.clientHeight || 200,
    };
    const ctx = new AudioContext();
    const audioSource = ctx.createMediaElementSource(audio);
    const analyzer = ctx.createAnalyser();
    audioSource.connect(analyzer);
    audioSource.connect(ctx.destination);
    const frequencyData = new Uint8Array(analyzer.frequencyBinCount);
    const canvas = initCanvas(container);
    const canvasCtx = canvas.getContext("2d");

    // Crear barras
    const renderBars = () => {
      resizeCanvas(canvas, container);
      analyzer.getByteFrequencyData(frequencyData);
      if (options.fftSize) {
        analyzer.fftSize = options.fftSize;
      }
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < options.numBars; i++) {
        const index = Math.floor((i + 10) * (i < options.numBars / 2 ? 2 : 1));
        const fd = frequencyData[index];
        const barHeight = Math.max(4, (fd / 255) * options.maxHeight);
        const barWidth = canvas.width / options.numBars;
        const x = i * barWidth;
        const y = canvas.height - barHeight;
        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(x, y, barWidth - 2, barHeight);
      }
      requestAnimationFrame(renderBars);
    };
    renderBars();

    // Listener del cambio de espacio en la ventana
    window.addEventListener("resize", () => {
      resizeCanvas(canvas, container);
    });
  };

  const cache = {};
  const pixel =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBgaAAAAIUAgbVRNccAAAAASUVORK5CYII=";
  const icons = {
    facebook: '<i class="ri-facebook-circle-fill"></i>',
    messenger: '<i class="ri-messenger-fill"></i>',
    youtube: '<i class="ri-youtube-fill"></i>',
    instagram: '<i class="ri-instagram-fill"></i>',
    whatsapp: '<i class="ri-whatsapp-fill"></i>',
    tiktok: '<i class="ri-tiktok-fill"></i>',
    play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" fill="white"/></svg>`,
    pause: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20"><path d="M6 5H10V19H6V5ZM14 5H18V19H14V5Z" fill="white"/></svg>`,
    volumeDown: '<i class="ri-volume-down-fill"></i>',
    volumeMute: '<i class="ri-volume-mute-fill"></i>',
    volumeUp: '<i class="ri-volume-up-fill"></i>',
    spotify: '<i class="ri-spotify-fill"></i>',
    bluesky: '<i class="ri-bluesky-fill"></i>',
    discord: '<i class="ri-discord-fill"></i>',
    soundcloud: '<i class="ri-soundcloud-fill"></i>',
    threads: '<i class="ri-threads-fill"></i>',
    twitter: '<i class="ri-twitter-fill"></i>',
    x: '<i class="ri-twitter-x-fill"></i>',
  };

  // Eliminar elementos innecesarios del texto
  // @param {string} text - Texto a limpiar
  function sanitizeText(text) {
    return text.replace(/^\d+\.\)\s/, "").replace(/<br>$/, "");
  }

  // Normaliza el historial de canciones
  // @param {Object} api - Datos de la API
  // @returns {Array} - Historial normalizado
  function normalizeHistory(api) {
    let artist;
    let title;
    const history = api.song_history || api.history || api.songHistory || [];
    const historyNormalized = history.map((item) => {
      if (api.song_history) {
        artist = item.song.artist;
        title = item.song.title;
      } else if (api.history) {
        artist = sanitizeText(item.split(" - ")[0] || item);
        title = sanitizeText(item.split(" - ")[1] || item);
      } else if (api.songHistory) {
        artist = item.artist;
        title = item.title || item.song;
      }
      return {
        artist,
        title,
      };
    });
    return historyNormalized;
  }

  // Normalizar título de la canción
  // @param {Object} api - Datos de la API
  // @returns {Object} - Título y artista normalizado
  function normalizeTitle(api) {
    let title;
    let artist;
    if (api.now_playing) {
      title = api.now_playing.song.title;
      artist = api.now_playing.song.artist;
    } else if (api.artist && api.title) {
      title = api.title;
      artist = api.artist;
    } else if (api.currenttrack_title) {
      title = api.currenttrack_title;
      artist = api.currenttrack_artist;
    } else if (api.title && api.djprofile && api.djusername) {
      title = api.title.split(" - ")[1];
      artist = api.title.split(" - ")[0];
    } else {
      title = api.currentSong;
      artist = api.currentArtist;
    }
    return {
      title,
      artist,
    };
  }
  function normalizeData(api) {
    return {
      ...normalizeTitle(api),
      history: [...normalizeHistory(api)],
    };
  }

  // Normaliza los datos de la canción
  // @param {object} data - Datos de la canción
  // @param {object} current - Datos de la estación actual
  function getSongDefaultData(data) {
    return {
      artist: data.artistName || data.artist || "Artist",
      title: data.trackName || data.title || "Title",
      artwork: {
        small: pixel,
        medium: pixel,
        large: pixel,
        xl: pixel,
      },
    };
  }

  // obtener datos de Itunes
  // @param {string} query - Búsqueda
  const getDataFromItunes = async (query) => {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`
    );
    const data = await response.json();

    // Si no responde
    if (!data.results) {
      return {};
    }
    const results = data.results[0];
    return results;
  };

  // Obtener Datos desde Stream Africa v2
  // @param {string} query - Búsqueda
  // @param {string} service - Fuente de los datos
  const getDataFromRadioApi = async (query) => {
      const response = await fetch(`https://radioapi.lat/search?query=${query}`);
    const data = await response.json();

    // Si no hay resultados
    if (!data.results) {
      return {};
    }
    const results = data.results;
    return results;
  };

  // Obtener Datos de la API
  // @param {string} query - Búsqueda
  // @returns {object} - Datos de la canción
  async function getDataFrom(query) {
    try {
      return await getDataFromRadioApi(query);
    } catch (error) {
      return await getDataFromItunes(query);
    }
  }

  // Obtener Datos de Canciones
  // @param {string} query - Búsqueda
  // @param {string} service - Fuente de los datos
  // @return {object} - Datos de la canción
  const getSongsData = async (defaultData, service = "itunes") => {
    const query = `${defaultData.artist} ${defaultData.title}`;
    const key = `${query} - ${service}`;

    // Si ya está en caché
    if (cache[key]) {
      return cache[key];
    }

    // Obtener datos si no está en caché
    const data = await getDataFrom(encodeURIComponent(query));
    const dataset = {
      ...defaultData,
      ...data,
    };
    const getArtwork = (size) =>
      data?.artworkUrl100.replace("100x100bb", `${size}x${size}bb`);
    if (data.artworkUrl100) {
      dataset.artwork60 = getArtwork(60);
      dataset.artwork100 = getArtwork(100);
      dataset.artwork300 = getArtwork(300);
      dataset.artwork500 = getArtwork(500);
      dataset.artwork1000 = getArtwork(1000);
    }

    // Guardar en caché
    cache[key] = dataset;
    return dataset;
  };

  // Devolver una promesa para saber si la imagen se ha cargado correctamente
  // @param {string} src - URL de la imagen
  // @returns {Promise} - Promesa que se resuelve si la imagen se carga correctamente
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Agrega una transición de deslizamiento a la imagen
  // @param {HTMLElement} container - Contenedor de la imagen
  // @param {string} src - URL de la imagen
  function slideUpImageTransition(container, src) {
    const img = document.createElement("img");
    const size = container.clientHeight;
    img.src = src;
    img.width = size;
    img.height = size;
    container.appendChild(img);
    const firstImg = container.querySelector("img:first-child");
    firstImg.style.marginLeft = `-${size}px`;
    firstImg.addEventListener(
      "transitionend",
      () => {
        const allImgExcLast = container.querySelectorAll(
          "img:not(:last-child)"
        );
        allImgExcLast.forEach((img) => img.remove());
      },
      {
        once: true,
      }
    );
  }

  // Agrega una transición de desvanecimiento a la imagen
  // @param {HTMLElement} container - Contenedor de la imagen
  // @param {string} src - URL de la imagen
  function fadeImageTransition(container, src) {
    container.style.opacity = 0;
    container.addEventListener("transitionend", () => {
      container.src = src;
      container.style.opacity = 0.5;
      container.addEventListener(
        "transitionend",
        () => {
          container.removeAttribute("style");
        },
        {
          once: true,
        }
      );
    });
  }

  const playButton = document.querySelector(".miniplayer-button-play");
  const visualizerContainer = document.querySelector(".visualizer");
  let hasVisualizer;
  let timeoutId;
  let currentSongPlaying;
  const TIMEOUT = window?.miniPlayer?.timeRefresh || 5000;
  const API_URL = window?.miniPlayer?.audioApi || false;
  const STREAM_URL = window?.miniPlayer?.streamUrl || false;
  const audio = new Audio();
  audio.src = STREAM_URL;
  audio.crossOrigin = "anonymous";
  if (playButton !== null) {
    playButton.addEventListener("click", async () => {
      if (audio.paused) {
        play();
      } else {
        pause();
      }
    });
  }
  function play() {
    audio.load();
    audio.play();
    playButton.innerHTML = `${icons.pause}`;
    playButton.classList.add("is-active");
    document.body.classList.add("is-playing");

    // Visualizer
    if (!hasVisualizer) {
      visualizer(audio, visualizerContainer);
      hasVisualizer = true;
    }
  }
  function pause() {
    audio.pause();
    playButton.innerHTML = `${icons.play}`;
    playButton.classList.remove("is-active");
    document.body.classList.remove("is-playing");
  }
  const range = document.querySelector(".miniplayer-volume-input");
  const rangeFill = document.querySelector(".miniplayer-range-fill");
  const rangeWrapper = document.querySelector(".miniplayer-range-wrapper");
  const rangeThumb = document.querySelector(".miniplayer-range-thumb");
  const volumeToggle = document.querySelector(".miniplayer-volume-toggle");
  const currentVolume = localStorage.getItem("volume") || 100;

  // Rango recorrido
  function setRangeWidth(percent) {
    {
      rangeFill.style.width = `${percent}%`;
    }
  }

  // Posición del thumb
  function setThumbPosition(percent) {
    const compensatedWidth = rangeWrapper.offsetWidth - rangeThumb.offsetWidth;
    const thumbPosition = (percent / 100) * compensatedWidth;
    {
      rangeThumb.style.left = `${thumbPosition}px`;
    }
  }

  // Actualiza el volumen al cambiar el rango
  function updateVolume(value) {
    range.value = value;
    setRangeWidth(value);
    setThumbPosition(value);
    localStorage.setItem("volume", value);
    audio.volume = value / 100;
    if (value === 0) {
      volumeToggle.innerHTML = icons.volumeMute;
    } else {
      volumeToggle.innerHTML = icons.volumeUp;
    }
  }

  // Valor inicial
  if (range !== null) {
    updateVolume(currentVolume);

    // Escucha el cambio del rango
    range.addEventListener("input", (event) => {
      updateVolume(event.target.value);
    });

    // Escucha el movimiento del mouse
    rangeThumb.addEventListener("mousedown", () => {
      document.addEventListener("mousemove", handleThumbDrag);
    });
  }

  // Mueve el thumb y actualiza el volumen
  function handleThumbDrag(event) {
    const rangeRect = range.getBoundingClientRect();
    const clickX = event.clientX - rangeRect.left;
    let percent = (clickX / range.offsetWidth) * 100;
    percent = percent; // Invertir el porcentaje si es vertical

    percent = Math.max(0, Math.min(100, percent));
    const value =
      Math.round((range.max - range.min) * (percent / 100)) +
      parseInt(range.min);
    updateVolume(value);
  }

  // Intercambiar entre 0% y 100% de volumen
  if (volumeToggle !== null) {
    volumeToggle.addEventListener("click", () => {
      if (audio.volume > 0) {
        updateVolume(0);
      } else {
        updateVolume(100);
      }
    });
  }

  // Deja de escuchar el movimiento del mouse
  document.addEventListener("mouseup", () => {
    document.removeEventListener("mousemove", handleThumbDrag);
  });
  window.addEventListener("resize", () => {
    const currentPercent = range.value;
    setRangeWidth(currentPercent);
    setThumbPosition(currentPercent);
  });

  // Cargar datos de la canción actual al navegador
  function setMediaSession(data) {
    const { title, artist, album, artwork, artworkUrl100, artworkUrl500 } =
      data;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          {
            src: artwork || artworkUrl100,
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: artwork || artworkUrl500,
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: artwork || artworkUrl500,
            sizes: "512x512",
            type: "image/png",
          },
        ],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        pause();
      });
    }
  }

  // Establecer datos de la canción actual
  function setCurrentSong(data) {
    const { title, artwork, artworkUrl100, artworkUrl500, artworkUrl1000 } =
      data;
    const songName = document.querySelector(".miniplayer-title");
    if (songName) {
      songName.textContent = title;
    }
    const pictureEl = document.querySelector(".miniplayer-player-image");
    const artworkUrl = artwork || artworkUrl500;
    if (pictureEl) {
      loadImage(artworkUrl)
        .then(() => slideUpImageTransition(pictureEl, artworkUrl))
        .catch(() => {
          console.error("Error al cargar arte de la canción");
        });
    }
    const coverEl = document.querySelector(".miniplayer-cover");
    if (coverEl) {
      const coverUrl =
        artwork || artworkUrl1000 || artworkUrl500 || artworkUrl100;
      const $img = document.createElement("img");
      $img.src = coverUrl;
      loadImage(coverUrl)
        .then(() => fadeImageTransition(coverEl, coverUrl))
        .catch(() => {
          console.error("Error al cargar la portada de la canción");
        });
    }
  }

  // Obtener datos de la estación
  function initApp() {
    if (timeoutId) clearTimeout(timeoutId);

    // DATOS DE LA CANCIÓN
    fetch(API_URL)
      .then((response) => response.json())
      .then(async (data) => {
        const song = normalizeData(data);
        if (currentSongPlaying !== song.title) {
          currentSongPlaying = song.title;
          const defaultData = getSongDefaultData(song);
          const songData = await getSongsData(defaultData);
          setCurrentSong(songData);
          setMediaSession(songData);
        }
      })
      .catch((error) => console.error("Error:", error));
    timeoutId = setTimeout(() => {
      initApp();
    }, TIMEOUT);
  }
  initApp();
})();
