# 🎯 Ruleta de Estudiantes

Una aplicación web interactiva para seleccionar estudiantes de forma aleatoria en clase. Perfecta para mantener la atención de los alumnos y hacer las selecciones de forma justa y divertida.

![Ruleta de Estudiantes](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Características

- 🎲 **Ruleta Animada**: Animación suave y realista con efectos de desaceleración
- 🔊 **Efectos de Sonido**: Sonidos generados dinámicamente usando Web Audio API
- 🎉 **Confetti**: Celebración visual con animación de confetti cuando se selecciona un estudiante
- 👥 **Gestión de Estudiantes**: Añadir y eliminar estudiantes fácilmente
- 🔄 **Modo Sin Repetir**: Opción para que no salgan estudiantes repetidos hasta que todos hayan participado
- ⚡ **Power-Ups**: Sorpresas aleatorias al girar (velocidad x2, cámara lenta, punto extra, trabajo en equipo, segunda oportunidad)
- 📊 **Estadísticas**: Seguimiento de cuántas veces ha salido cada estudiante y sus puntos extra ⭐
- 📋 **Historial**: Ver las últimas 10 selecciones (se conserva al recargar)
- ⌨️ **Atajos de teclado**: `Espacio` para girar, `Esc` para cerrar el resultado
- 💾 **Persistencia de Datos**: Los datos se guardan automáticamente en el navegador
- 📤 **Importar/Exportar**: Guarda y carga listas de estudiantes para diferentes clases
- 🌙 **Tema Oscuro/Claro**: Cambia entre temas según tu preferencia
- 📱 **Diseño Responsive**: Funciona perfecto en móvil, tablet y escritorio

## 🚀 Uso

### Opción 1: Uso Local

1. Descarga todos los archivos del proyecto
2. Abre `index.html` en tu navegador web
3. ¡Listo para usar!

### Opción 2: GitHub Pages

1. Haz fork de este repositorio o crea uno nuevo
2. Sube los archivos (`index.html`, `style.css`, `script.js`) al repositorio
3. Ve a Settings > Pages
4. En "Source", selecciona la rama `main` (o `master`)
5. Guarda los cambios
6. Tu aplicación estará disponible en `https://tu-usuario.github.io/nombre-repositorio`

## 📖 Instrucciones

### Gestionar Estudiantes

1. **Añadir estudiante**: Escribe el nombre en el campo de texto y haz clic en "➕ Añadir" o presiona Enter. Puedes añadir varios separados por comas o pegar una columna de nombres
2. **Eliminar estudiante**: Haz clic en el botón "✕ Eliminar" junto al nombre del estudiante

### Girar la Ruleta

1. Haz clic en el botón central "GIRAR RULETA"
2. La ruleta girará durante 4 segundos con un "clic" cada vez que pasa un nombre (también puedes pulsar `Espacio`)
3. Se mostrará un modal con el estudiante seleccionado y confetti

### Modo Sin Repetir

Activa la casilla "Modo sin repetir" para que no salgan estudiantes que ya han sido seleccionados: la ruleta solo muestra a quienes faltan y verás cuántos quedan en la ronda. Una vez que todos hayan participado, empieza una ronda nueva automáticamente.

### Power-Ups

Activa "⚡ Power-Ups Activados" y, en aproximadamente una de cada tres tiradas, aparecerá una sorpresa:

| Power-Up | Efecto |
|---|---|
| ⚡ Velocidad x2 | La ruleta gira el doble de rápido |
| 🐢 Cámara lenta | La ruleta gira a cámara lenta para dar suspense |
| ⭐ Punto extra | El seleccionado suma un punto extra en las estadísticas |
| 🤝 Trabajo en equipo | Se elige también a un compañero para ayudar |
| 🔄 Segunda oportunidad | El seleccionado se libra y la ruleta vuelve a girar al cerrar |

### Importar/Exportar Datos

- **Exportar**: Guarda tus estudiantes, estadísticas, puntos extra e historial en un archivo JSON
- **Importar**: Carga un archivo JSON previamente exportado, o un `.txt`/`.csv` con un nombre por línea

### Cambiar Tema

Haz clic en el botón 🌙/☀️ en la parte superior derecha para cambiar entre tema claro y oscuro.

## 🎨 Personalización

### Cambiar Colores

Edita las variables CSS en `style.css`:

```css
:root {
    --accent-1: #ff6b6b;
    --accent-2: #4ecdc4;
    --accent-3: #45b7d1;
    /* ... más colores */
}
```

### Modificar Sonidos

Los sonidos se generan usando Web Audio API. Puedes modificar las frecuencias y duraciones en la clase `SoundGenerator` en `script.js`.

## 🛠️ Tecnologías

- **HTML5**: Estructura semántica
- **CSS3**: Diseño moderno con gradientes, glassmorphism y animaciones
- **JavaScript ES6+**: Lógica interactiva
- **Canvas API**: Para renderizar la ruleta y el confetti
- **Web Audio API**: Generación de efectos de sonido
- **LocalStorage**: Persistencia de datos

## 📱 Compatibilidad

- ✅ Chrome/Edge (versiones recientes)
- ✅ Firefox (versiones recientes)
- ✅ Safari (versiones recientes)
- ✅ Opera (versiones recientes)
- ✅ Navegadores móviles (iOS Safari, Chrome Android)

## 🎓 Casos de Uso

- Seleccionar estudiantes para corregir actividades
- Elegir quién sale a presentar
- Asignar turnos de participación
- Crear grupos aleatorios
- Actividades interactivas en clase

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT. Puedes usarlo, modificarlo y distribuirlo libremente.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si encuentras un bug o tienes una sugerencia, no dudes en abrir un issue o pull request.

## 👨‍🏫 Consejos para Profesores

1. **Proyecta la pantalla**: Para mayor engagement, proyecta la ruleta en la pizarra digital
2. **Crea expectativa**: Haz una cuenta regresiva antes de girar la ruleta
3. **Celebra las victorias**: Deja que suene la música y se vea el confetti
4. **Múltiples listas**: Usa la función de importar/exportar para diferentes clases o grupos
5. **Estadísticas**: Revisa las estadísticas periódicamente para asegurar equidad

---

Hecho con ❤️ para mejorar la experiencia en el aula
