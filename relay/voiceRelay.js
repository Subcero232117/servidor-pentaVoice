// Inicia un loop de proximidad usando datos y callbacks provistos.
export function startProximityRelay(playersMap, broadcast, maxDistance = 32) {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  const tick = () => {
    const clients = Array.from(playersMap.values());

    for (const me of clients) {
      me.hear = clients
        .filter(other =>
          me.name !== other.name &&
          me.dim === other.dim &&
          distance(me, other) <= maxDistance
        )
        .map(other => other.name);
    }

    broadcast({
      event: "proximity_update",
      data: clients.map(c => ({
        name: c.name,
        hear: c.hear
      }))
    });
  };

  // actualizar cada ~200ms
  return setInterval(tick, 200);
}
