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

//Uso de ED Para el Juego

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