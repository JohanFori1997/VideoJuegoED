// =========================================================================
// game.js - CONFIGURACIÓN GLOBAL Y ESTRUCTURAS DE DATOS
// =========================================================================
const CANVAS_HEIGHT = 600;
const TIME_STEP = 0.01; // dt (paso de tiempo para la integración RK4)
// Definición de constantes para los escenarios (Requisito: Contextos de Simulación)
const WORLD_SETTINGS = {
    'TierraAire': { g: 9.8, k: 0.05, modelo: 'lineal', descripcion: 'Resistencia del aire moderada' },
    'TierraSinAire': { g: 9.8, k: 0.0, modelo: 'galileo', descripcion: 'Modelo ideal (sin fricción)' },
    'Luna': { g: 1.62, k: 0.0, modelo: 'galileo', descripcion: 'Baja gravedad, sin fricción' },
    'Agua': { g: 9.8, k: 5.0, modelo: 'lineal', descripcion: 'Alta viscosidad (modelo lineal)' },
    'Jupiter': { g: 24.79, k: 0.1, modelo: 'cuadratico', descripcion: 'Alta gravedad y fricción (alta velocidad)' },
    'Personalizado': { g: 9.8, k: 0.0, modelo: 'lineal', descripcion: 'Configuración manual de variables' }
};

let gameState = {
    currentScreen: 'menu',
    selectedWorld: null,
    g: 9.8,            // Gravedad actual (m/s²)
    k: 0.0,            // Coeficiente de resistencia actual
    masa: 0.1,         // Masa del objeto (kg). Nota: 100g de input se convierte a 0.1kg
    y0: 100,           // Altura inicial (m)
    v0: 0,             // Velocidad inicial (m/s)
    objeto: { x: 0, y: 0, v: 0, tiempo: 0, cayendo: false },
    cayendo: false,
    impactado: false
};

// Poses de apuntado del soldado
const shooterFrontImage = new Image();
shooterFrontImage.src = 'assets/Sprites/Sprite1-frente.png'; // Ruta a la imagen de 159x188

const shooterUpImage = new Image();
shooterUpImage.src = 'assets/Sprites/Sprite1-up.png'; // Ruta a la imagen de 101x219

// --- Dimensiones de las Poses (Necesarias para el dibujo estático) ---
const FRONT_WIDTH = 159;
const FRONT_HEIGHT = 188;

const UP_WIDTH = 101;
const UP_HEIGHT = 219;

// Usaremos la pose más alta (UP_HEIGHT) para definir la posición Y del soldado en el suelo
const SOLDIER_HEIGHT = UP_HEIGHT;
const SOLDIER_WIDTH = FRONT_WIDTH; // Usaremos el ancho de la pose frontal como referencia

// --- Constantes de Posición del Tirador en el Canvas (Estática) ---
const SHOOTER_CANVAS_X = 100;
const SHOOTER_CANVAS_Y = CANVAS_HEIGHT - SOLDIER_HEIGHT;

// 1. Ladrón en Caída (el objeto que reemplaza al punto amarillo)
const thiefFallingImage = new Image();
thiefFallingImage.src = 'assets/Sprites/Sprite2-Cayendo.png'; 

// 2. Ladrón Estático (colgado en el edificio al inicio de la partida)
const thiefClimbingImage = new Image();
thiefClimbingImage.src = 'assets/Sprites/Sprite2-Colgado.png'; 

// 3. Ladrón en el Suelo (Nueva Imagen)
const thiefImpactImage = new Image();
thiefImpactImage.src = 'assets/img/thief_impact.png';
// --- Dimensiones del Ladrón ---

// Dimensiones de la pose de CAÍDA (Objeto que se mueve)
const FALLING_WIDTH = 140;
const FALLING_HEIGHT = 147;

// Dimensiones de la pose ESTÁTICA/COLGADA (En el edificio)
const CLIMBING_WIDTH = 91;
const CLIMBING_HEIGHT = 154;

const IMPACT_WIDTH = 300; // Ajusta a la dimensión real de tu sprite de impacto
const IMPACT_HEIGHT = 300;
// --- Constante de Control del Mouse ---
// Umbral de altura en píxeles para cambiar de pose.
// Si el mouse está por encima de esta línea, el soldado apunta hacia arriba.
const UP_THRESHOLD_Y = CANVAS_HEIGHT * 0.7;

// Altura del suelo del mundo real (y_world = 0) en píxeles.
const GROUND_Y_PIXEL = 600; // Asumiendo CANVAS_HEIGHT = 600

let shooterDirection = 0;

let mouseX = 0;
let mouseY = 0;

let simulationHistory = [];

// Referencias del DOM (Declaradas globalmente para acceso en todas las funciones)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null; // Verificación por si el DOM no carga aún

const btnIniciar = document.getElementById('btn-iniciar');
const modalChart = document.getElementById('chart-modal');
const closeChartBtn = document.getElementById('close-chart-modal');
const btnVerGrafico = document.getElementById('btn-ver-grafico');
const thiefImage = new Image();
thiefImage.src = 'assets/img/thief.png'; // RUTA A TU IMAGEN DEL LADRÓN

// const shooterImage = new Image();
// shooterImage.src = 'assets/img/shooter.png'; // RUTA A TU IMAGEN DEL TIRADOR

// Dimensiones esperadas para las imágenes (ajusta según el tamaño real de tus archivos)
const THIEF_WIDTH = 50;
const THIEF_HEIGHT = 80;
const SHOOTER_WIDTH = 100;
const SHOOTER_HEIGHT = 100;

// =========================================================================
// LÓGICA DE FÍSICA Y ECUACIONES DIFERENCIALES
// =========================================================================

/**
 * Calcula el dv/dt (aceleración) según el modelo de arrastre.
 */
function getAcceleration(v) {
    const m = gameState.masa;
    const g = gameState.g;
    const k = gameState.k;
    const modelo = WORLD_SETTINGS[gameState.selectedWorld]?.modelo || 'lineal';

    let a = g;

    // Fuerza de arrastre (resistencia)
    if (modelo === 'lineal' || modelo === 'TierraAire' || modelo === 'Agua') {
        a -= (k / m) * v;
    } else if (modelo === 'cuadratico' || modelo === 'Jupiter') {
        a -= (k / m) * v * Math.abs(v);
    }

    return a;
}

/**
 * Método de Runge-Kutta 4 (RK4) para actualizar la velocidad y posición.
 */
function rungeKutta4() {
    let obj = gameState.objeto;
    const dt = TIME_STEP;

    // RK4 para la Velocidad (v)
    let k1_v = getAcceleration(obj.v);
    let k2_v = getAcceleration(obj.v + 0.5 * dt * k1_v);
    let k3_v = getAcceleration(obj.v + 0.5 * dt * k2_v);
    let k4_v = getAcceleration(obj.v + dt * k3_v);

    obj.v += (dt / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);

    // Actualizar Posición (y)
    let delta_y = obj.v * dt;
    obj.y -= delta_y; // 'y' se reduce al caer (medida desde el inicio)

    obj.tiempo += dt;
}

/**
 * Solución Analítica de v(t) para el Modelo Lineal.
 */
function v_t_lineal(t, m, g, k) {
    if (k <= 0) return g * t; // Si k es 0 o negativo, usar Galileo
    const Vt = (m * g) / k;
    return Vt * (1 - Math.exp(-(k / m) * t));
}

/**
 * Solución Analítica de v(t) para el Modelo Cuadrático.
 */
function v_t_cuadratico(t, m, g, k) {
    if (k <= 0) return g * t; // Si k es 0 o negativo, usar Galileo
    const Vt = Math.sqrt((m * g) / k);
    return Vt * Math.tanh(Math.sqrt((g * k) / m) * t);
}

/**
 * Calcula la velocidad terminal analítica para el modelo actual.
 */
function calculateTerminalVelocity() {
    const m = gameState.masa;
    const g = gameState.g;
    const k = gameState.k;
    const modelo = WORLD_SETTINGS[gameState.selectedWorld]?.modelo || 'lineal';

    if (k <= 0.0 || modelo === 'galileo') {
        return Infinity;
    } else if (modelo === 'lineal') {
        return (m * g) / k;
    } else if (modelo === 'cuadratico') {
        return Math.sqrt((m * g) / k);
    }
    return 0;
}

// =========================================================================
// LÓGICA DE DIBUJO Y RENDERIZADO (CANVAS)
// =========================================================================

/**
 * Convierte la posición Y del mundo real (metros) a la posición Y del Canvas (píxeles).
 */
function worldToCanvasY(y_world, y_max) {
    if (!y_max || y_max === 0) return CANVAS_HEIGHT; // Evitar división por cero
    // Escala: y=0 (suelo) -> CANVAS_HEIGHT, y=y_max -> parte superior
    return CANVAS_HEIGHT - (y_world / y_max) * CANVAS_HEIGHT;
}

/**
 * Dibuja todos los elementos del juego.
 */
function drawGame() {
    if (!ctx) return;

    // El fondo se gestiona por CSS, solo limpiamos el área de dibujo
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Suelo (Asegura que el ladrón impactado se dibuje JUSTO encima de esta línea)
    ctx.fillStyle = '#0a0'; 
    ctx.fillRect(0, CANVAS_HEIGHT - 10, canvas.width, 10);

    // 1. Dibujar el Edificio (Ejemplo Simple)
    // ctx.fillStyle = '#666';
    // ctx.fillRect(canvas.width / 2 - 50, 0, 100, CANVAS_HEIGHT);

    // -----------------------------------------------------------
    // 2. DIBUJAR AL LADRÓN ESTÁTICO (SOLO ANTES DEL DISPARO)
    // -----------------------------------------------------------
    
    // La imagen del ladrón COLGANDO/ESCALANDO aparece solo si NO está cayendo
    if (!gameState.objeto.cayendo && !gameState.objeto.impactado) {
        
        const climbing_y_pixel = worldToCanvasY(gameState.y0, gameState.y0);
        
        if (thiefClimbingImage.complete && thiefClimbingImage.naturalWidth !== 0) {
            ctx.drawImage(
                thiefClimbingImage,
                canvas.width / 2 + 10, // Un poco a la derecha del edificio
                climbing_y_pixel - CLIMBING_HEIGHT, // Base del sprite en la línea y0
                CLIMBING_WIDTH,
                CLIMBING_HEIGHT
            );
        } else {
            // Fallback si la imagen no carga
            ctx.fillStyle = 'red';
            ctx.font = '20px Arial';
            ctx.fillText('LADRÓN (Cargando)', canvas.width / 2 - 40, climbing_y_pixel);
        }
    }
    
    // -----------------------------------------------------------
    // 3. DIBUJAR AL LADRÓN EN CAÍDA (Reemplaza el punto amarillo)
    // -----------------------------------------------------------
    if (gameState.objeto.cayendo) {
        
        const y_pixel = worldToCanvasY(gameState.objeto.y, gameState.y0);

        if (thiefFallingImage.complete && thiefFallingImage.naturalWidth !== 0) {
            
            // Dibujar la imagen del ladrón cayendo
            ctx.drawImage(
                thiefFallingImage,
                canvas.width / 2 - FALLING_WIDTH / 2, // Centrar la imagen en X
                y_pixel - FALLING_HEIGHT / 2, // Centrar la imagen en Y (para que el centro sea el punto de cálculo)
                FALLING_WIDTH,
                FALLING_HEIGHT
            );
        } else {
            // Fallback: dibujar el círculo amarillo si la imagen no carga
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(canvas.width / 2, y_pixel, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // -----------------------------------------------------------
    // 4. DIBUJAR AL LADRÓN IMPACTADO (NUEVA LÓGICA)
    // -----------------------------------------------------------
    if (gameState.objeto.impactado) {
        
        // Posición Y en el suelo (CANVAS_HEIGHT)
        const impact_y_pixel = CANVAS_HEIGHT - 10; 

        if (thiefImpactImage.complete && thiefImpactImage.naturalWidth !== 0) {
            
            // --- CÓDIGO CORREGIDO ---
            const drawX = canvas.width / 2 - IMPACT_WIDTH / 2; // Centrado en X
            const drawY = impact_y_pixel - IMPACT_HEIGHT;      // <-- ESTA ES LA CLAVE: 
                                                               // Restamos la altura total de la imagen del suelo.

            ctx.drawImage(
                thiefImpactImage,
                drawX, // Posición X (Centrado)
                drawY, // Posición Y (Base de la imagen en el suelo)
                IMPACT_WIDTH,
                IMPACT_HEIGHT
            );
        }
        // ... (Fallback si la imagen no carga) ...
    }
    // -----------------------------------------------------------
    // 3. DIBUJAR AL TIRADOR (IMAGEN)
    // -----------------------------------------------------------
    // Posición del Tirador: Abajo a la izquierda
    if (shooterUpImage.complete && shooterUpImage.naturalWidth !== 0) {

        // Mapeo de la hoja de sprites para 'Sprite1.jpg':
        let sx = 0; // Coordenada X de recorte de la fuente
        let sy = 0; // Coordenada Y de recorte de la fuente

    } else {
        // Fallback si la imagen no carga
        ctx.fillStyle = 'blue';
        ctx.fillText('TIRADOR', 50, CANVAS_HEIGHT - 20);
    }

    let imageToDraw;
    let currentWidth;
    let currentHeight;

    // Si el mouse está en el cuadrante superior (por encima del umbral Y), apuntar arriba.
    if (mouseY < UP_THRESHOLD_Y) {
        imageToDraw = shooterUpImage;
        currentWidth = UP_WIDTH;
        currentHeight = UP_HEIGHT;
    } else {
        // Si el mouse está en el cuadrante inferior, apuntar al frente.
        imageToDraw = shooterFrontImage;
        currentWidth = FRONT_WIDTH;
        currentHeight = FRONT_HEIGHT;
    }

    if (imageToDraw.complete && imageToDraw.naturalWidth !== 0) {

        // Ajuste de la posición Y para que los pies queden en el mismo lugar: 
        // Siempre dibujamos la imagen actual en la posición y estática,
        // y la diferencia de altura se maneja automáticamente.
        const drawX = SHOOTER_CANVAS_X - currentWidth / 2; // Centrado
        const drawY = SHOOTER_CANVAS_Y + (SOLDIER_HEIGHT - currentHeight); // Ajuste de pies

        ctx.drawImage(
            imageToDraw,
            drawX,
            drawY,
            currentWidth,
            currentHeight
        );
    } else {
        // Fallback si la imagen no carga
        ctx.fillStyle = 'blue';
        ctx.fillText('TIRADOR (Cargando...)', 50, CANVAS_HEIGHT - 20);
    }
}

// =========================================================================
// CONTROL DE ESTADO E INTERFAZ (UI/UX)
// =========================================================================

/**
 * Función para cambiar de pantalla
 */
function changeScreen(newScreen) {
    document.querySelectorAll('.game-screen').forEach(el => {
        el.classList.remove('active');
    });
    const targetScreen = document.getElementById(`screen-${newScreen}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    gameState.currentScreen = newScreen;
}

/**
 * Función para actualizar los datos en tiempo real (DEBE SER GLOBAL)
 */
function updateDataDisplay() {
    const yMax = gameState.y0;

    document.getElementById('data-velocidad').textContent = gameState.objeto.v.toFixed(2);

    // Altura sobre el suelo = y_max - y_actual
    const altura_sobre_suelo = yMax - gameState.objeto.y;

    document.getElementById('data-altura').textContent = altura_sobre_suelo > 0 ? altura_sobre_suelo.toFixed(2) : '0.00';
    document.getElementById('data-peso').textContent = (gameState.masa * gameState.g).toFixed(2);
}

/**
 * Lógica de Disparo (Inicia la simulación) - DEBE SER GLOBAL
 */
function handleShot(event) {
    if (!gameState.objeto.cayendo && gameState.currentScreen === 'game') {

        // Reiniciar variables
        gameState.objeto.y = gameState.y0;
        gameState.objeto.v = gameState.v0;
        gameState.objeto.tiempo = 0;

        simulationHistory = []; // ¡LIMPIAR HISTORIAL!

        gameState.objeto.cayendo = true;

        gameState.objeto.x = canvas.width / 2;

        // Deshabilitar la validación hasta que termine la caída
        document.getElementById('btn-validar-vt').disabled = true;
        document.getElementById('vt-resultado').textContent = ''; // Limpiar resultado anterior
    }
}

// =========================================================================
// BUCLE PRINCIPAL DEL JUEGO
// =========================================================================

/**
 * Bucle principal de simulación y renderizado (función update)
 */
function gameLoop() {
    // 1. Lógica de Simulación
    if (gameState.objeto.cayendo) {
        if (gameState.objeto.y > 0) {
            rungeKutta4();

            // RECOLECCIÓN DE DATOS para el gráfico (cada 10 pasos de tiempo)
            if (Math.floor(gameState.objeto.tiempo * 100) % 10 === 0) {
                simulationHistory.push({
                    t: gameState.objeto.tiempo,
                    v: gameState.objeto.v
                });
            }

        } else {
            // Detener la caída
            gameState.objeto.cayendo = false;
            gameState.objeto.y = 0; // Posición final (el suelo)
            gameState.objeto.impactado = true;
            document.getElementById('btn-validar-vt').disabled = false;

            // Asegurarse de que el último punto se añade al historial si no está ya
            if (simulationHistory.length > 0 && simulationHistory[simulationHistory.length - 1].t !== gameState.objeto.tiempo) {
                simulationHistory.push({ t: gameState.objeto.tiempo, v: gameState.objeto.v });
            }
            alert(`Caída Terminada. Tiempo total: ${gameState.objeto.tiempo.toFixed(2)} s`);
        }

        // 2. Renderizado (Drawing) y Actualización de la Interfaz
        drawGame();
        updateDataDisplay();
    }
    // Siempre dibujamos la pantalla de juego si es la activa, incluso si el objeto no cae
    else if (gameState.currentScreen === 'game') {
        drawGame();
        updateDataDisplay();
    }

    requestAnimationFrame(gameLoop);
}

// =========================================================================
// LÓGICA DE GRÁFICOS (CHART.JS)
// =========================================================================

/**
 * Función que genera los puntos de datos para las curvas de comparación.
 */
function generateComparativeData(totalTime) {
    const labels = [];
    const simulatedData = [];
    const galileoData = [];
    const Vt_analytic = calculateTerminalVelocity();

    const m = gameState.masa;
    const g = gameState.g;
    const k = gameState.k;
    const modelo = WORLD_SETTINGS[gameState.selectedWorld]?.modelo || 'lineal';

    // Usamos el historial recolectado (simulación numérica RK4)
    simulationHistory.forEach(point => {
        labels.push(point.t.toFixed(1));
        simulatedData.push(point.v);
        // Curva Galileo
        galileoData.push(g * point.t + gameState.v0);
    });

    // Si no hay historial (ejecutar caída por primera vez), usamos la solución analítica
    if (simulationHistory.length === 0) {
        let time = 0;
        const dt = 0.1;

        while (time <= totalTime * 1.5) {
            labels.push(time.toFixed(1));
            galileoData.push(g * time + gameState.v0);

            // Usar la solución analítica correspondiente
            if (modelo === 'lineal' || modelo === 'TierraAire' || modelo === 'Agua') {
                simulatedData.push(v_t_lineal(time, m, g, k));
            } else if (modelo === 'cuadratico' || modelo === 'Jupiter') {
                simulatedData.push(v_t_cuadratico(time, m, g, k));
            } else {
                simulatedData.push(g * time + gameState.v0);
            }
            time += dt;
        }
    }

    return { labels, simulatedData, galileoData, Vt_analytic };
}

/**
 * Función de Renderizado del Gráfico (Usando Chart.js)
 */
function renderVelocityChart(labels, simulatedData, galileoData, Vt_analytic) {
    let chartCanvas = document.getElementById('velocityChart');
    if (!chartCanvas) return;

    if (window.velocityChartInstance) {
        window.velocityChartInstance.destroy();
    }

    const ctxChart = chartCanvas.getContext('2d');

    window.velocityChartInstance = new Chart(ctxChart, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Modelo Simulado (Resistencia)',
                    data: simulatedData,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Modelo Ideal (Galileo)',
                    data: galileoData,
                    borderColor: 'rgb(255, 99, 132)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Velocidad Terminal (Vt)',
                    data: labels.map(() => Vt_analytic),
                    borderColor: 'rgb(255, 205, 86)',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: 'Tiempo (s)' }
                },
                y: {
                    title: { display: true, text: 'Velocidad (m/s)' },
                    min: 0
                }
            }
        }
    });
}

function calculateShooterDirection() {
    // Usamos el punto de disparo (el arma) como origen
    const originX = SHOOTER_CANVAS_X; // Estimar el centro del soldado
    const originY = SHOOTER_CANVAS_Y + (DRAW_HEIGHT / 2);

    // Calcular el vector del soldado al mouse
    const dx = mouseX - originX;
    const dy = mouseY - originY;

    // Calcular el ángulo en radianes y luego en grados
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);

    // Mapeamos el ángulo para apuntar hacia la parte superior derecha (0° a -90°)
    // El tirador está a la izquierda del ladrón, por lo que solo nos interesa el cuadrante superior derecho
    angleDeg = Math.abs(angleDeg); // Convertimos el ángulo negativo (hacia arriba) a positivo (0 a 180)

    // 1. Limitar el ángulo (no puede apuntar hacia abajo/izquierda)
    if (angleDeg > 90) {
        angleDeg = 90; // Máximo 90 grados (apuntando recto hacia arriba)
    }

    // 2. Mapear el ángulo (0° a 90°) a un índice de sprite (0 a 4)
    // El sprite sheet tiene 5 poses principales: 0°, 20°, 45°, 75°, 90°.

    if (angleDeg >= 80) {
        shooterDirection = 0; // Cerca de 90° (Arriba)
    } else if (angleDeg >= 60) {
        shooterDirection = 1; // 75° (Diagonal Alta)
    } else if (angleDeg >= 35) {
        shooterDirection = 2; // 45° (Diagonal Media)
    } else if (angleDeg >= 10) {
        shooterDirection = 3; // 20° (Diagonal Baja)
    } else {
        shooterDirection = 4; // Cerca de 0° (Derecha)
    }
}

// =========================================================================
// INICIALIZACIÓN DE EVENTOS (Asegura que el DOM está cargado)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Iniciar el gameLoop
    gameLoop();

    // --- 1. Eventos de Selección de Mundo (Pantalla 1) ---
    const worldButtons = document.querySelectorAll('#world-options button');

    worldButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // 1. Limpiar la clase 'selected' de todos los botones para deseleccionar el anterior
            worldButtons.forEach(b => b.classList.remove('selected'));

            // 2. Establecer el mundo actual y marcar el botón como seleccionado
            gameState.selectedWorld = e.target.dataset.world;
            e.target.classList.add('selected'); // Opcional, pero útil para UX

            // 3. Habilitar el botón INICIAR
            btnIniciar.disabled = false;
        });
    });

    btnIniciar.addEventListener('click', () => {
        // La lógica de INICIAR (pasar a la configuración)
        const settings = WORLD_SETTINGS[gameState.selectedWorld];

        // Cargar y Habilitar/Deshabilitar inputs
        document.getElementById('input-gravedad').value = settings.g;
        document.getElementById('input-resistencia').value = settings.k;

        const isCustom = gameState.selectedWorld === 'Personalizado';
        document.getElementById('input-gravedad').disabled = !isCustom;
        document.getElementById('input-resistencia').disabled = !isCustom;

        changeScreen('config'); // Mover a la pantalla de configuración
    });

    // --- 2. Evento de Comienzo del Juego (Pantalla 2) ---
    document.getElementById('btn-comenzar-juego').addEventListener('click', () => {
        // Actualizar gameState con los valores ingresados por el usuario
        gameState.masa = parseFloat(document.getElementById('input-masa').value) / 1000; // g -> kg
        gameState.y0 = parseFloat(document.getElementById('input-altura').value);
        gameState.g = parseFloat(document.getElementById('input-gravedad').value);
        gameState.k = parseFloat(document.getElementById('input-resistencia').value);
        gameState.v0 = parseFloat(document.getElementById('input-v0').value);

        if (gameState.masa <= 0 || gameState.y0 <= 0) {
            alert("La masa y la altura deben ser valores positivos mayores a cero.");
            return;
        }

        changeScreen('game');

        // 1. Limpiar todas las clases 'bg-' anteriores
        canvas.className = '';

        // 2. Aplicar la nueva clase de fondo según el mundo seleccionado
        if (gameState.selectedWorld) {
            canvas.classList.add(`bg-${gameState.selectedWorld}`);
        }
        // Inicializa el dibujo de la partida estática (antes del disparo)
        gameState.objeto.y = gameState.y0;
        gameState.objeto.v = gameState.v0;
        gameState.objeto.tiempo = 0;
        updateDataDisplay();
        drawGame();
    });

    // --- 3. Eventos de la Partida (Pantalla 3) ---

    // Listener de Disparo: Al hacer clic en el Canvas, se llama a handleShot
    if (canvas) {
        canvas.addEventListener('click', handleShot);
    }

    // Listener de Retorno
    document.getElementById('btn-volver-menu').addEventListener('click', () => {
        changeScreen('menu');
        btnIniciar.disabled = true;
    });

    // Listener de Validación de Velocidad Terminal (Vt)
    document.getElementById('btn-validar-vt').addEventListener('click', () => {
        const vtUsuario = parseFloat(document.getElementById('input-vt-usuario').value);
        const vtAnalitica = calculateTerminalVelocity();
        const resultadoEl = document.getElementById('vt-resultado');

        if (isNaN(vtUsuario)) {
            resultadoEl.textContent = "Ingrese un valor válido.";
            return;
        }

        const tolerancia = 0.05; // 5% de tolerancia
        if (Math.abs(vtUsuario - vtAnalitica) / (vtAnalitica === 0 ? 1 : vtAnalitica) < tolerancia) {
            resultadoEl.textContent = "¡CORRECTO! ✅ V_terminal = " + (isFinite(vtAnalitica) ? vtAnalitica.toFixed(2) : "∞") + " m/s.";
        } else {
            resultadoEl.textContent = "INCORRECTO. La V_terminal analítica es: " + (isFinite(vtAnalitica) ? vtAnalitica.toFixed(2) : "∞") + " m/s.";
        }
    });

    // Listener de Gráficos
    if (btnVerGrafico) {
        btnVerGrafico.addEventListener('click', () => {
            if (gameState.objeto.cayendo) {
                alert("La simulación debe terminar antes de ver el gráfico de análisis.");
                return;
            }
            // Asegura que la gráfica se extienda lo suficiente para ver la Vt
            const maxTime = gameState.objeto.tiempo > 0 ? gameState.objeto.tiempo * 1.5 : 10;
            const { labels, simulatedData, galileoData, Vt_analytic } = generateComparativeData(maxTime);
            renderVelocityChart(labels, simulatedData, galileoData, Vt_analytic);

            modalChart.style.display = 'block';
        });
    }

    // Listener para cerrar el modal
    if (closeChartBtn) {
        closeChartBtn.addEventListener('click', () => {
            modalChart.style.display = 'none';
        });
    }

    // Listener para capturar la posición del mouse y calcular la dirección
    if (canvas) {
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = event.clientX - rect.left;
            mouseY = event.clientY - rect.top;
        });

        // Listener de Disparo
        canvas.addEventListener('click', handleShot);
    }
});