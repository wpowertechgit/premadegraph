const dataset = require("./prototypeData.json");

const players = dataset.nodes.map((node) => ({
  id: node.id,
  label: node.label,
}));

const datasetSummary = {
  players: dataset.nodes.length,
  relationships: dataset.edges.length,
  allyRelationships: dataset.edges.filter((edge) => edge.relation === "ally").length,
  enemyRelationships: dataset.edges.filter((edge) => edge.relation === "enemy").length,
};

module.exports = {
  nodes: dataset.nodes,
  edges: dataset.edges,
  players,
  datasetSummary,
};
