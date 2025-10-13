// =========================================================================
// game.js - CONFIGURACIÓN GLOBAL Y ESTRUCTURAS DE DATOS
// =========================================================================

// Definición de constantes para los escenarios (Requisito: Contextos de Simulación)
const WORLD_SETTINGS = {
    'TierraAire':      { g: 9.8, k: 0.05, modelo: 'lineal', descripcion: 'Resistencia del aire moderada' },
    'TierraSinAire':   { g: 9.8, k: 0.0, modelo: 'galileo', descripcion: 'Modelo ideal (sin fricción)' },
    'Luna':            { g: 1.62, k: 0.0, modelo: 'galileo', descripcion: 'Baja gravedad, sin fricción' },
    'Agua':            { g: 9.8, k: 5.0, modelo: 'lineal', descripcion: 'Alta viscosidad (modelo lineal)' },
    'Jupiter':         { g: 24.79, k: 0.1, modelo: 'cuadratico', descripcion: 'Alta gravedad y fricción (alta velocidad)' },
    'Personalizado':   { g: 9.8, k: 0.0, modelo: 'lineal', descripcion: 'Configuración manual de variables' }
};

let gameState = {
    currentScreen: 'menu',
    selectedWorld: null,
    g: 9.8,            // Gravedad actual (m/s²)
    k: 0.0,            // Coeficiente de resistencia actual
    masa: 0.1,         // Masa del objeto (kg). Nota: 100g de input se convierte a 0.1kg
    y0: 100,           // Altura inicial (m)
    v0: 0,             // Velocidad inicial (m/s)
    objeto: { x: 0, y: 0, v: 0, tiempo: 0, cayendo: false }
};

let simulationHistory = [];
const CANVAS_HEIGHT = 600;
const TIME_STEP = 0.01; // dt (paso de tiempo para la integración RK4)

// Referencias del DOM (Declaradas globalmente para acceso en todas las funciones)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null; // Verificación por si el DOM no carga aún

const btnIniciar = document.getElementById('btn-iniciar');
const modalChart = document.getElementById('chart-modal');
const closeChartBtn = document.getElementById('close-chart-modal');
const btnVerGrafico = document.getElementById('btn-ver-grafico');
const thiefImage = new Image();
thiefImage.src = 'assets/img/thief.png'; // RUTA A TU IMAGEN DEL LADRÓN

const shooterImage = new Image();
shooterImage.src = 'assets/img/shooter.png'; // RUTA A TU IMAGEN DEL TIRADOR

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

    // 1. Dibujar el Edificio (Ejemplo Simple)
    ctx.fillStyle = '#666';
    ctx.fillRect(canvas.width / 2 - 50, 0, 100, CANVAS_HEIGHT);

    // -----------------------------------------------------------
    // 2. DIBUJAR AL LADRÓN (IMAGEN)
    // -----------------------------------------------------------
    // Posición Y del Ladrón: Cerca de la parte superior del edificio
    const thief_y_pixel = worldToCanvasY(gameState.y0, gameState.y0); 
    
    // Aseguramos que la imagen se haya cargado antes de dibujarla
    if (thiefImage.complete && thiefImage.naturalWidth !== 0) {
        ctx.drawImage(
            thiefImage,
            canvas.width / 2 + 10, // Un poco a la derecha del edificio
            thief_y_pixel - THIEF_HEIGHT, // La base del ladrón estará en esa línea y
            THIEF_WIDTH,
            THIEF_HEIGHT
        );
    } else {
        // Fallback si la imagen no carga (mantener el texto)
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText('LADRÓN 💰', canvas.width / 2 - 40, thief_y_pixel);
    }

    // -----------------------------------------------------------
    // 3. DIBUJAR AL TIRADOR (IMAGEN)
    // -----------------------------------------------------------
    // Posición del Tirador: Abajo a la izquierda
    if (shooterImage.complete && shooterImage.naturalWidth !== 0) {
        ctx.drawImage(
            shooterImage,
            50, // Posición X (cerca de la izquierda)
            CANVAS_HEIGHT - SHOOTER_HEIGHT, // Base del tirador en el suelo
            SHOOTER_WIDTH,
            SHOOTER_HEIGHT
        );
    } else {
        // Fallback si la imagen no carga
        ctx.fillStyle = 'blue';
        ctx.fillText('TIRADOR', 50, CANVAS_HEIGHT - 20);
    }
    
    // -----------------------------------------------------------

    // 4. Dibujar el Objeto en Caída
    if (gameState.objeto.cayendo || gameState.objeto.tiempo > 0) {
        // La posición y_max debe ser la altura inicial (y0)
        const y_pixel = worldToCanvasY(gameState.objeto.y, gameState.y0);

        // Objeto (Círculo simple que representa la masa)
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, y_pixel, 10, 0, Math.PI * 2);
        ctx.fill();

        // Línea de la trayectoria
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, y_pixel);
        ctx.stroke();
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

// =========================================================================
// INICIALIZACIÓN DE EVENTOS (Asegura que el DOM está cargado)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Iniciar el gameLoop
    gameLoop(); 
    
    // --- 1. Eventos de Selección de Mundo (Pantalla 1) ---
    document.querySelectorAll('#world-options button').forEach(button => {
        button.addEventListener('click', (e) => {
            gameState.selectedWorld = e.target.dataset.world;
            document.querySelectorAll('#world-options button').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected'); 
            btnIniciar.disabled = false;
        });
    });

    btnIniciar.addEventListener('click', () => {
        const settings = WORLD_SETTINGS[gameState.selectedWorld];
        
        // Cargar y Habilitar/Deshabilitar inputs
        document.getElementById('input-gravedad').value = settings.g;
        document.getElementById('input-resistencia').value = settings.k;

        const isCustom = gameState.selectedWorld === 'Personalizado';
        document.getElementById('input-gravedad').disabled = !isCustom;
        document.getElementById('input-resistencia').disabled = !isCustom;
        
        changeScreen('config'); 
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
});