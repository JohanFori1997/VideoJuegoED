PROYECTO: DISPARA AL LADRÓN - SIMULADOR DE ECUACIONES DIFERENCIALES
===================================================================

Este proyecto es un videojuego educativo interactivo diseñado para simular el movimiento de caída libre bajo diferentes modelos de resistencia (Lineal y Cuadrático), aplicando las soluciones analíticas de Ecuaciones Diferenciales.

=========================
1. MANUAL DE USUARIO (GUÍA RÁPIDA)
=========================

### 1.1 Pantalla Principal: Selección de Mundo

Al iniciar la aplicación, seleccione el entorno de simulación que desea explorar. Cada mundo precarga parámetros físicos específicos (gravedad, coeficiente de resistencia 'k' y modelo de resistencia).

* **Tierra (Con Aire):** Simulación de caída con resistencia del aire.
* **Tierra Sin Aire:** Modelo Galileo (Ideal) con k=0, validando la teoría de que la masa no afecta la aceleración en el vacío.
* **Luna:** Baja gravedad y sin resistencia.
* **Júpiter / Agua:** Entornos extremos con alta gravedad o alta viscosidad.
* **Personalizado:** Permite configurar manualmente todos los valores (Gravedad y Resistencia 'k').

Haga clic en un mundo y luego en **INICIAR**.

### 1.2 Pantalla de Configuración de Variables

Ajuste las condiciones iniciales del experimento:

* **MASA (g):** Masa del objeto que cae.
* **ALTURA (m):** Posición inicial del objeto (y0).
* **GRAVEDAD (m/s²) / RESISTENCIA (k):** Valores editables solo si se selecciona el modo "Personalizado".

Haga clic en **COMENZAR PARTIDA** para cargar el escenario.

### 1.3 Pantalla de Juego y Simulación

1.  **Observación Inicial:** El soldado (Tirador) estará estático a la izquierda, y el ladrón estará colgado en la parte superior central.
2.  **Apuntado:** Mueva el cursor del mouse sobre el canvas. El soldado cambiará su pose para apuntar hacia arriba o al frente, siguiendo la posición vertical del cursor.
3.  **Iniciar Caída (El Disparo):** **Haga clic en cualquier lugar del canvas**. Este evento simula el "disparo" que hace que el ladrón suelte el objeto, iniciando la simulación de caída libre. El ladrón colgado desaparece y es reemplazado por la imagen del ladrón en caída.
4.  **Finalización:** La caída termina cuando el ladrón toca la línea verde del suelo (y=0 metros). La imagen cambia a la pose de impacto (ladrón derribado) justo sobre la línea verde.

### 1.4 Herramientas de Análisis y Validación

* **Validación de Velocidad Terminal (Vt):**
    * Ingrese el valor de la Velocidad Terminal (Vt) que calculó analíticamente para el modelo seleccionado en el campo "Vt calculada (m/s)".
    * Haga clic en **Validar Vt**. El sistema compara su valor con el cálculo analítico interno.

* **Gráfico Comparativo:**
    * Haga clic en **Ver Gráfico de Análisis** después de que la caída haya terminado.
    * El gráfico muestra tres curvas superpuestas:
        1.  **Modelo Simulado (Resistencia):** Curva generada por la integración RK4 (o la solución analítica).
        2.  **Modelo Ideal (Galileo):** Curva lineal que ignora la fricción.
        3.  **Línea Vt:** Línea horizontal que valida la velocidad límite del modelo.

=========================
2. CONTEXTO ACADÉMICO
=========================

Este simulador cumple con los requisitos del proyecto de Ecuaciones Diferenciales para el modelado de caída libre con fricción:

* **Modelado de EDOs:** Implementa los modelos de **Resistencia Lineal** (proporcional a 'v') y **Resistencia Cuadrática** (proporcional a 'v²').
* **Solución Numérica:** Utiliza el método de **Runge-Kutta 4 (RK4)** para resolver numéricamente las EDOs, garantizando una simulación precisa del movimiento.
* **Análisis Gráfico:** Provee la herramienta de superposición de gráficos para validar visualmente cómo la solución con fricción se aproxima asintóticamente a la Velocidad Terminal, contrastando con el modelo ideal de Galileo.
