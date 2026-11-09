function audit(event, details, level = 'info') {
  if (process.env.NODE_ENV === 'test') return;

  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details
  }) + '\n');
}

module.exports = audit;
