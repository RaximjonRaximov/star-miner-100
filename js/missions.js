const MISSIONS = (function () {
  const resources = ['iron', 'copper', 'silver', 'gold', 'platinum', 'uranium', 'crystal'];
  const upgradeDefs = {
    laser: 'Mining Laser',
    cargo: 'Cargo Bay',
    drone: 'Mining Drone',
    refinery: 'Refinery',
    scanner: 'Deep Scanner',
    warp: 'Warp Drive'
  };
  const upgradeKeys = Object.keys(upgradeDefs);
  const types = ['collect', 'earn', 'click', 'upgrade', 'spend', 'sell', 'reach', 'allResources'];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (n) => {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toString();
  };

  const missions = [];
  for (let i = 0; i < 100; i++) {
    const type = types[i % types.length];
    const tier = Math.floor(i / 10) + 1;
    const resource = resources[i % resources.length];
    const upgradeId = upgradeKeys[i % upgradeKeys.length];
    const scale = Math.pow(1.15, i);
    let target, title, description, reward;

    switch (type) {
      case 'collect': {
        target = Math.floor(20 * scale * tier);
        title = `Mine ${fmt(target)} ${cap(resource)}`;
        description = `Mine ${fmt(target)} units of ${cap(resource)} from asteroids.`;
        reward = Math.floor(target * 0.6);
        break;
      }
      case 'earn': {
        target = Math.floor(100 * scale * tier);
        title = `Earn ${fmt(target)} Credits`;
        description = `Sell resources to earn a total of ${fmt(target)} credits.`;
        reward = Math.floor(target * 0.25);
        break;
      }
      case 'click': {
        target = Math.floor(50 + 30 * i * Math.pow(1.08, i));
        title = `Click ${fmt(target)} Times`;
        description = `Click the asteroid ${fmt(target)} times to mine manually.`;
        reward = Math.floor(target * 2.5);
        break;
      }
      case 'upgrade': {
        target = 2 + Math.floor(i / 6);
        title = `Upgrade ${upgradeDefs[upgradeId]} to Level ${target}`;
        description = `Improve your ${upgradeDefs[upgradeId]} to level ${target}.`;
        reward = Math.floor(target * 50 * scale);
        break;
      }
      case 'spend': {
        target = Math.floor(150 * scale * tier);
        title = `Spend ${fmt(target)} Credits`;
        description = `Invest ${fmt(target)} credits in upgrades.`;
        reward = Math.floor(target * 0.18);
        break;
      }
      case 'sell': {
        target = Math.floor(200 * scale * tier);
        title = `Sell ${fmt(target)} Credits Worth`;
        description = `Sell resources worth at least ${fmt(target)} credits.`;
        reward = Math.floor(target * 0.12);
        break;
      }
      case 'reach': {
        target = Math.floor(500 * Math.pow(1.25, i));
        title = `Reach ${fmt(target)} Credits`;
        description = `Have ${fmt(target)} credits in your wallet at once.`;
        reward = Math.floor(target * 0.12);
        break;
      }
      case 'allResources': {
        target = Math.floor(10 + 5 * i * Math.pow(1.05, i));
        title = `Collect ${fmt(target)} of Every Resource`;
        description = `Mine at least ${fmt(target)} units of each resource type.`;
        reward = Math.floor(target * 90);
        break;
      }
    }

    missions.push({
      id: i + 1,
      type,
      resource,
      upgradeId,
      target,
      title,
      description,
      reward,
      completed: false,
      claimed: false
    });
  }
  return missions;
})();
