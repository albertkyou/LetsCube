module.exports = {
  apps : [{
    name: 'letscube-api',
    script: 'NODE_ENV=prod server/index.js',

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: '',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'prod'
    }
  }],

  deploy : {
    production : {
      user : 'www',
      host : '127.0.0.1',
      ref  : 'origin/master',
      repo : 'git@github.com:coder13/letscube',
      path : '/var/www/production',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env prod'
    }
  }
};
