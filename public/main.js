// Main JS for CASECARE AI
document.addEventListener('DOMContentLoaded', () => {
  console.log('CASECARE AI Prototype Loaded');
  
  // Auto-dismiss alerts
  const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });
});