if (location.protocol === 'file:') {
  document.getElementById('notice').textContent = 'Open this tool from its website to prepare firmware.';
  document.getElementById('local-preview').hidden = false;
} else {
  import('./app.js').catch(() => {
    document.getElementById('notice').textContent = 'Could not open the tool. Please reload the page.';
    document.getElementById('notice').classList.add('error');
  });
}
