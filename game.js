// =========================================================================
// game.js - CONFIGURACIÓN GLOBAL Y ESTRUCTURAS DE DATOS
// =========================================================================

// --- Constantes Físicas, Dimensiones y DOM (Declaración Única y Temprana) ---
const CANVAS_WIDTH = 800; 
const CANVAS_HEIGHT = 600; 
const TIME_STEP = 0.01; 

// Valores del experimento del proyecto (Tercer Corte)
const K_ANALYTIC = 0.015; 
const M_EXPERIMENT = 0.07; 
const G_GRAVITY = 9.81; 
const VT_ANALYTIC_FINAL = 45780; 
const K_DIV_M = 214.285e-6; 

// --- Dimensiones de los Sprites ---
const FRONT_WIDTH = 159;
const FRONT_HEIGHT = 188;
const UP_WIDTH = 101;
const UP_HEIGHT = 219;
const SOLDIER_HEIGHT = UP_HEIGHT; 

const FALLING_WIDTH = 140;
const FALLING_HEIGHT = 147;
const CLIMBING_WIDTH = 91;
const CLIMBING_HEIGHT = 154;
const IMPACT_WIDTH = 150; 
const IMPACT_HEIGHT = 80;

// --- Constantes de Posición ---
const SHOOTER_CANVAS_X = 100; 
const SHOOTER_CANVAS_Y = CANVAS_HEIGHT - SOLDIER_HEIGHT; 
const UP_THRESHOLD_Y = CANVAS_HEIGHT * 0.7; 
const VISIBLE_GROUND_Y = CANVAS_HEIGHT - 10; 

// --- Carga de Imágenes (Assets) ---
const shooterFrontImage = new Image();
shooterFrontImage.src = 'assets/Sprites/Sprite1-frente.png'; 

const shooterUpImage = new Image();
shooterUpImage.src = 'assets/Sprites/Sprite1-up.png'; 

const thiefFallingImage = new Image();
thiefFallingImage.src = 'assets/Sprites/Sprite2-Cayendo.png'; 

const thiefClimbingImage = new Image();
thiefClimbingImage.src = 'assets/Sprites/Sprite2-Colgado.png'; 

const thiefImpactImage = new Image();
thiefImpactImage.src = 'assets/img/thief_impact.png';

// --- Referencias DOM y Estado ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const btnIniciar = document.getElementById('btn-iniciar');
const modalChart = document.getElementById('chart-modal');
const closeChartBtn = document.getElementById('close-chart-modal'); // Ícono 'x'
const btnVerGrafico = document.getElementById('btn-ver-grafico');

let mouseX = 0;
let mouseY = 0;
let simulationHistory = [];

const WORLD_SETTINGS = {
    'TierraAire':      { g: G_GRAVITY, k: K_ANALYTIC, modelo: 'lineal', descripcion: 'Resistencia modelada con los datos experimentales.' },
    'TierraSinAire':   { g: 9.81, k: 0.0, modelo: 'galileo', descripcion: 'Modelo ideal (sin fricción)' },
    'Luna':            { g: 1.62, k: 0.0, modelo: 'galileo', descripcion: 'Baja gravedad, sin fricción' },
    'Agua':            { g: 9.81, k: 5.0, modelo: 'lineal', descripcion: 'Alta viscosidad (modelo lineal)' },
    'Jupiter':         { g: 24.79, k: 0.1, modelo: 'cuadratico', descripcion: 'Alta gravedad y fricción (alta velocidad)' },
    'Personalizado':   { g: G_GRAVITY, k: 0.0, modelo: 'lineal', descripcion: 'Configuración manual de variables' }
};

let gameState = {
    currentScreen: 'menu',
    selectedWorld: null,
    g: G_GRAVITY,      
    k: K_ANALYTIC,      
    masa: M_EXPERIMENT, 
    y0: 100,          
    v0: 0,            
    objeto: { x: 0, y: 0, v: 0, tiempo: 0, cayendo: false, impactado: false }
};

// =========================================================================
// LÓGICA DE FÍSICA Y ECUACIONES DIFERENCIALES
// =========================================================================

function getAcceleration(v) {
    const m = gameState.masa;
    const g = gameState.g;
    const k = gameState.k;
    const modelo = WORLD_SETTINGS[gameState.selectedWorld]?.modelo || 'lineal';
    
    let a = g; 

    if (modelo === 'lineal' || modelo === 'TierraAire' || modelo === 'Agua') {
        a -= (k / m) * v; 
    } else if (modelo === 'cuadratico' || modelo === 'Jupiter') {
        a -= (k / m) * v * Math.abs(v); 
    } 
    
    return a;
}

function rungeKutta4() {
    let obj = gameState.objeto;
    const dt = TIME_STEP;
    
    let k1_v = getAcceleration(obj.v);
    let k2_v = getAcceleration(obj.v + 0.5 * dt * k1_v);
    let k3_v = getAcceleration(obj.v + 0.5 * dt * k2_v);
    let k4_v = getAcceleration(obj.v + dt * k3_v);
    
    obj.v += (dt / 6.0) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
    
    let delta_y = obj.v * dt;
    obj.y -= delta_y; 

    obj.tiempo += dt;
}

function eulerStep(v, m, g, k, dt) {
    return v + (g - (k / m) * v) * dt;
}

function v_t_lineal(t, m, g, k) {
    if (k <= 0) return g * t; 
    const Vt = (m * g) / k;
    return Vt * (1 - Math.exp(-(k / m) * t));
}

function v_t_cuadratico(t, m, g, k) {
    if (k <= 0) return g * t; 
    const Vt = Math.sqrt((m * g) / k);
    return Vt * Math.tanh(Math.sqrt((g * k) / m) * t);
}

function v_t_laplace(t) {
    return VT_ANALYTIC_FINAL * (Math.exp(K_DIV_M * t) - 1);
}

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

function worldToCanvasY(y_world, y_max) {
    if (!y_max || y_max === 0) return CANVAS_HEIGHT; 
    return CANVAS_HEIGHT - (y_world / y_max) * CANVAS_HEIGHT;
}

function drawGame() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    // Suelo (Línea verde)
    ctx.fillStyle = '#0a0'; 
    ctx.fillRect(0, VISIBLE_GROUND_Y, canvas.width, 10);
    
    // -----------------------------------------------------------
    // 2. DIBUJAR AL LADRÓN ESTÁTICO (CLIMBING)
    // -----------------------------------------------------------
    if (!gameState.objeto.cayendo && !gameState.objeto.impactado) {
        
        const climbing_x_pixel = canvas.width / 2 - CLIMBING_WIDTH / 2;
        const climbing_y_pixel = worldToCanvasY(gameState.y0, gameState.y0);
        
        if (thiefClimbingImage.complete && thiefClimbingImage.naturalWidth !== 0) {
            ctx.drawImage(
                thiefClimbingImage,
                climbing_x_pixel, 
                climbing_y_pixel - CLIMBING_HEIGHT, 
                CLIMBING_WIDTH,
                CLIMBING_HEIGHT
            );
        } else {
            ctx.fillStyle = 'red';
            ctx.font = '20px Arial';
            ctx.fillText('LADRÓN (Cargando)', canvas.width / 2 - 40, climbing_y_pixel);
        }
    }
    
    // -----------------------------------------------------------
    // 3. DIBUJAR AL LADRÓN EN CAÍDA (FALLING)
    // -----------------------------------------------------------
    if (gameState.objeto.cayendo) {
        
        const y_pixel = worldToCanvasY(gameState.objeto.y, gameState.y0);

        if (thiefFallingImage.complete && thiefFallingImage.naturalWidth !== 0) {
            ctx.drawImage(
                thiefFallingImage,
                canvas.width / 2 - FALLING_WIDTH / 2, 
                y_pixel - FALLING_HEIGHT / 2, 
                FALLING_WIDTH,
                FALLING_HEIGHT
            );
        } else {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(canvas.width / 2, y_pixel, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // -----------------------------------------------------------
    // 4. DIBUJAR AL LADRÓN IMPACTADO (IMPACT)
    // -----------------------------------------------------------
    if (gameState.objeto.impactado) {
        
        const impact_y_pixel = VISIBLE_GROUND_Y; 

        if (thiefImpactImage.complete && thiefImpactImage.naturalWidth !== 0) {
            
            const drawX = canvas.width / 2 - IMPACT_WIDTH / 2; 
            const drawY = impact_y_pixel - IMPACT_HEIGHT;      

            ctx.drawImage(
                thiefImpactImage,
                drawX, 
                drawY, 
                IMPACT_WIDTH,
                IMPACT_HEIGHT
            );
        }
    }
    
    // -----------------------------------------------------------
    // 5. DIBUJAR AL TIRADOR (LÓGICA DE DOS POSES)
    // -----------------------------------------------------------
    let imageToDraw;
    let currentWidth;
    let currentHeight;
    
    if (mouseY < UP_THRESHOLD_Y) {
        imageToDraw = shooterUpImage;
        currentWidth = UP_WIDTH;
        currentHeight = UP_HEIGHT;
    } else {
        imageToDraw = shooterFrontImage;
        currentWidth = FRONT_WIDTH;
        currentHeight = FRONT_HEIGHT;
    }

    if (imageToDraw.complete && imageToDraw.naturalWidth !== 0) {
        
        const drawX = SHOOTER_CANVAS_X - currentWidth / 2;
        const drawY = SHOOTER_CANVAS_Y + (SOLDIER_HEIGHT - currentHeight); 

        ctx.drawImage(
            imageToDraw,
            drawX, 
            drawY,
            currentWidth,
            currentHeight
        );
    } else {
        ctx.fillStyle = 'blue';
        ctx.fillText('TIRADOR (Cargando...)', 50, CANVAS_HEIGHT - 20);
    }
}

// =========================================================================
// CONTROL DE ESTADO, BUCLE PRINCIPAL Y NAVEGACIÓN
// =========================================================================

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

function updateDataDisplay() {
    const yMax = gameState.y0; 
    
    document.getElementById('data-velocidad').textContent = gameState.objeto.v.toFixed(4);
    
    const altura_sobre_suelo = yMax - gameState.objeto.y;

    document.getElementById('data-altura').textContent = altura_sobre_suelo > 0 ? altura_sobre_suelo.toFixed(4) : '0.0000';
    document.getElementById('data-peso').textContent = (gameState.masa * gameState.g).toFixed(4);
}

function handleShot(event) {
    if (!gameState.objeto.cayendo && gameState.currentScreen === 'game' && !gameState.objeto.impactado) {
        
        gameState.objeto.y = gameState.y0; 
        gameState.objeto.v = gameState.v0; 
        gameState.objeto.tiempo = 0;
        
        simulationHistory = []; 
        
        gameState.objeto.cayendo = true;
        gameState.objeto.impactado = false; 
        
        gameState.objeto.x = canvas.width / 2; 
        
        document.getElementById('btn-validar-vt').disabled = true;
        document.getElementById('vt-resultado').textContent = ''; 
    }
}

function gameLoop() {
    if (gameState.objeto.cayendo) {
        if (gameState.objeto.y > 0) {
            rungeKutta4();
            
            if (Math.floor(gameState.objeto.tiempo * 100) % 10 === 0) {
                simulationHistory.push({ 
                    t: gameState.objeto.tiempo, 
                    v: gameState.objeto.v 
                });
            }
        } else {
            gameState.objeto.cayendo = false;
            gameState.objeto.y = 0; 
            gameState.objeto.impactado = true; 
            
            document.getElementById('btn-validar-vt').disabled = false;

            alert(`✅ Simulación Finalizada. Tiempo total: ${gameState.objeto.tiempo.toFixed(4)} s`);
            
            if (simulationHistory.length > 0 && simulationHistory[simulationHistory.length - 1].t !== gameState.objeto.tiempo) {
                 simulationHistory.push({ t: gameState.objeto.tiempo, v: gameState.objeto.v });
            }
        }
        
        drawGame(); 
        updateDataDisplay();
    } 
    else if (gameState.currentScreen === 'game') {
        drawGame(); 
        updateDataDisplay(); 
    }
    
    requestAnimationFrame(gameLoop);
}

// =========================================================================
// LÓGICA DE GRÁFICOS Y ANÁLISIS
// =========================================================================

function generateComparativeData(totalTime) {
    const labels = [];
    const simulatedData = [];
    const galileoData = [];
    const laplaceData = [];
    const eulerData = [];
    
    const Vt_analytic = calculateTerminalVelocity();
    
    const m = gameState.masa;
    const g = gameState.g;
    const k = gameState.k;
    const modelo = WORLD_SETTINGS[gameState.selectedWorld]?.modelo || 'lineal';
    
    const isLaplaceScenario = gameState.selectedWorld === 'TierraAire'; 
    const isLinearModel = modelo === 'lineal';

    let v_euler = gameState.v0; 
    const dt_euler = 0.1; 

    // Bucle 1: Usando HISTORIAL DE SIMULACIÓN (RK4)
    simulationHistory.forEach(point => {
        labels.push(point.t.toFixed(1));
        simulatedData.push(point.v);
        
        galileoData.push(g * point.t + gameState.v0); 
        
        if (isLinearModel && isLaplaceScenario) {
             laplaceData.push(v_t_laplace(point.t));
        } else {
             laplaceData.push(null);
        }
        
        // No calculamos Euler aquí
        eulerData.push(null); 
    });
    
    // Bucle 2: Si el historial está vacío (generar data analítica/teórica)
    if (simulationHistory.length === 0) {
        let time = 0; 
        const dt = 0.1;

        v_euler = gameState.v0; 
        
        while (time <= totalTime * 1.5) { 
            labels.push(time.toFixed(1));
            galileoData.push(g * time + gameState.v0); 

            // Cálculo del Modelo Discreto de Euler
            if (isLinearModel) {
                 v_euler = eulerStep(v_euler, m, g, k, dt_euler);
                 eulerData.push(v_euler);
            } else {
                 eulerData.push(null);
            }
            
            // Simulación Analítica (para superposición)
            if (isLinearModel || modelo === 'TierraAire' || modelo === 'Agua') {
                simulatedData.push(v_t_lineal(time, m, g, k));
            } else if (modelo === 'cuadratico' || modelo === 'Jupiter') {
                simulatedData.push(v_t_cuadratico(time, m, g, k));
            } else {
                simulatedData.push(g * time + gameState.v0);
            }

            // Solución de Laplace para la curva de verificación
            if (isLinearModel && isLaplaceScenario) {
                 laplaceData.push(v_t_laplace(time));
            } else {
                 laplaceData.push(null);
            }
            
            time += dt;
        }
    }

    return { labels, simulatedData, galileoData, Vt_analytic, laplaceData, eulerData };
}

function renderVelocityChart(labels, simulatedData, galileoData, Vt_analytic, laplaceData, eulerData) {
    let chartCanvas = document.getElementById('velocityChart');
    if (!chartCanvas) return;
    
    if (window.velocityChartInstance) {
        window.velocityChartInstance.destroy();
    }

    const ctxChart = chartCanvas.getContext('2d');
    
    let datasets = [
        {
            label: 'Modelo Numérico (RK4)', 
            data: simulatedData,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1, fill: false, pointRadius: 0
        },
        {
            label: 'Modelo Ideal (Galileo)',
            data: galileoData,
            borderColor: 'rgb(255, 99, 132)',
            borderDash: [5, 5], tension: 0.1, fill: false, pointRadius: 0
        },
        {
            label: 'Velocidad Terminal (Vt)',
            data: labels.map(() => Vt_analytic),
            borderColor: 'rgb(255, 205, 86)',
            borderWidth: 2, pointRadius: 0
        }
    ];

    // --- AÑADIR LOS DATASETS DE TERCER CORTE ---
    if (laplaceData && Array.isArray(laplaceData) && laplaceData.some(d => d !== null)) {
        datasets.push({
            label: 'Solución Analítica (Laplace)',
            data: laplaceData,
            borderColor: 'rgb(0, 255, 0)', 
            borderDash: [2, 2],
            borderWidth: 3,
            tension: 0.1, fill: false, pointRadius: 0
        });
    }

    if (eulerData && Array.isArray(eulerData) && eulerData.some(d => d !== null)) {
        datasets.push({
            label: 'Modelo Discreto (Euler)',
            data: eulerData,
            borderColor: 'rgb(255, 165, 0)', 
            borderDash: [10, 5],
            borderWidth: 2,
            tension: 0, 
            fill: false, 
            pointRadius: 1 
        });
    }

    window.velocityChartInstance = new Chart(ctxChart, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
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
// INICIALIZACIÓN DE EVENTOS (ROBUSTA)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    gameLoop(); 
    
    // --- Lógica de Menú y Navegación General ---
    const worldButtons = document.querySelectorAll('#world-options button');
    
    worldButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            worldButtons.forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            gameState.selectedWorld = e.target.dataset.world;
            btnIniciar.disabled = false;
        });
    });

    btnIniciar.addEventListener('click', () => {
        const settings = WORLD_SETTINGS[gameState.selectedWorld];
        
        document.getElementById('input-gravedad').value = settings.g;
        document.getElementById('input-resistencia').value = settings.k;

        const isCustom = gameState.selectedWorld === 'Personalizado';
        const isTierraAire = gameState.selectedWorld === 'TierraAire';
        
        document.getElementById('input-gravedad').disabled = !isCustom;
        document.getElementById('input-resistencia').disabled = !(isCustom || isTierraAire);
        
        changeScreen('config'); 
    });

    document.getElementById('btn-comenzar-juego').addEventListener('click', () => {
        
        gameState.masa = parseFloat(document.getElementById('input-masa').value) / 1000; 
        gameState.y0 = parseFloat(document.getElementById('input-altura').value);
        gameState.g = parseFloat(document.getElementById('input-gravedad').value);
        gameState.k = parseFloat(document.getElementById('input-resistencia').value);
        gameState.v0 = parseFloat(document.getElementById('input-v0').value);

        if (gameState.masa <= 0 || gameState.y0 <= 0) {
            alert("La masa y la altura deben ser valores positivos mayores a cero.");
            return;
        }

        changeScreen('game');
        
        if (canvas) {
            canvas.className = '';
            canvas.classList.add(`bg-${gameState.selectedWorld}`);
        }
        
        gameState.objeto.y = gameState.y0; 
        gameState.objeto.v = gameState.v0;
        gameState.objeto.tiempo = 0;
        gameState.objeto.impactado = false; 
        updateDataDisplay();
        drawGame(); 
    });
    
    // --- ASIGNACIÓN ROBUSTA DE LISTENERS (Corrige el botón de regreso) ---
    
    // 1. Botón de regreso de la PANTALLA DE CONFIGURACIÓN
    const btnVolverMenuConfig = document.querySelector('#screen-config #btn-volver-menu');
    if (btnVolverMenuConfig) {
        btnVolverMenuConfig.addEventListener('click', () => {
            changeScreen('menu');
            btnIniciar.disabled = true;
        });
    }

    // 2. Botón de regreso de la PANTALLA DE JUEGO (EL QUE ESTABA FALLANDO)
    const btnVolverMenuGame = document.querySelector('#screen-game #btn-volver-menu'); 
    if (btnVolverMenuGame) {
         btnVolverMenuGame.addEventListener('click', () => {
            gameState.objeto.cayendo = false;
            gameState.objeto.impactado = false;
            changeScreen('menu');
            btnIniciar.disabled = true;
        });
    }
    
    // --- Listeners de Interacción del Mouse ---
    if (canvas) {
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = event.clientX - rect.left;
            mouseY = event.clientY - rect.top;
        });
        canvas.addEventListener('click', handleShot); 
    }
    
    // --- Listeners de Gráficos y Validación ---
    document.getElementById('btn-validar-vt').addEventListener('click', () => {
        const vtUsuario = parseFloat(document.getElementById('input-vt-usuario').value);
        const vtAnalitica = calculateTerminalVelocity();
        const resultadoEl = document.getElementById('vt-resultado');

        if (isNaN(vtUsuario)) {
            resultadoEl.textContent = "Ingrese un valor válido.";
            return;
        }

        const tolerancia = 0.05; 
        const isCorrect = Math.abs(vtUsuario - vtAnalitica) / (vtAnalitica === 0 ? 1 : vtAnalitica) < tolerancia;
        
        resultadoEl.textContent = isCorrect 
            ? "¡CORRECTO! ✅ V_terminal = " + (isFinite(vtAnalitica) ? vtAnalitica.toFixed(4) : "∞") + " m/s."
            : "INCORRECTO. La V_terminal analítica es: " + (isFinite(vtAnalitica) ? vtAnalitica.toFixed(4) : "∞") + " m/s.";
    });

    if (btnVerGrafico) {
        btnVerGrafico.addEventListener('click', () => {
            if (gameState.objeto.cayendo) {
                alert("La simulación debe terminar antes de ver el gráfico de análisis.");
                return;
            }
            const maxTime = gameState.objeto.tiempo > 0 ? gameState.objeto.tiempo * 1.5 : 10;
            const { labels, simulatedData, galileoData, Vt_analytic, laplaceData, eulerData } = generateComparativeData(maxTime);
            renderVelocityChart(labels, simulatedData, galileoData, Vt_analytic, laplaceData, eulerData);
            
            modalChart.style.display = 'block';
        });
    }

    // Listeners para cerrar el modal
    if (closeChartBtn) {
        closeChartBtn.addEventListener('click', () => {
            modalChart.style.display = 'none';
        });
    }
    const btnCloseModal = document.getElementById('close-chart-modal-btn');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modalChart.style.display = 'none';
        });
    }
});