// Quick script to generate a menu bar icon
const fs = require('fs');

// A minimal 18x18 calendar icon in PNG format (base64 encoded)
// This is a template image - macOS will handle dark/light mode automatically
const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAtklEQVR4nO2YwQ6AIAxD+f+f1oMm6phtdOIY+hIu0tFugQRgjDHmnUQVF6kQVZxAopE9RBV3YS9ShxF5RBV3Ie1QDp0jcdtH1+rjgfMOHYpW1DqUiCquQq5D3DqUiDquQppD3DrUiCruQtJD7QeOpfX25FwxmQvU0SZLwpbGSyeQtpNQXeZH0p6VBfmR9GFn09G7/WJSaCb+l9T+sDUkNBdOjSQ0F460h81E/UPkDHGmJfZABXBLKAz0O7VAAAAAElFTkSuQmCC';

fs.writeFileSync(
    require('path').join(__dirname, 'assets', 'iconTemplate.png'),
    Buffer.from(iconBase64, 'base64')
);

console.log('Icon created!');
