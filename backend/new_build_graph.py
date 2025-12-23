import json
import os
import sqlite3
import networkx as nx
from networkx.algorithms import community
from pyvis.network import Network
import sys
import argparse
from collections import defaultdict
from typing import Dict, Set, List, Tuple

# === CONFIG ===
MATCH_FOLDER = "./data"
DB_PATH = "../playersrefined.db"
OUTPUT_HTML = "output/premade_network.html"

# === Load match data ===
def load_matches_from_folder(folder_path: str) -> List[dict]:
    """Load all match JSON files from folder"""
    matches = []
    for filename in os.listdir(folder_path):
        if filename.startswith("EUN1_") and filename.endswith(".json"):
            filepath = os.path.join(folder_path, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    matches.append(json.load(file))
            except (json.JSONDecodeError, IOError) as e:
                print(f"Failed to load {filename}: {e}")
    return matches

# === Build association graph (optimized) ===
def build_graph_from_matches(matches: List[dict]) -> nx.Graph:
    """Build graph efficiently using edge aggregation"""
    edge_weights = defaultdict(int)
    
    for match in matches:
        try:
            puuids = [p["puuid"] for p in match["info"]["participants"]]
        except KeyError:
            continue
        
        # Build edges
        for i in range(len(puuids)):
            for j in range(i + 1, len(puuids)):
                edge = tuple(sorted([puuids[i], puuids[j]]))
                edge_weights[edge] += 1
    
    # Create graph from aggregated edges
    G = nx.Graph()
    G.add_weighted_edges_from([(u, v, w) for (u, v), w in edge_weights.items()])
    
    return G

# === Get latest name from names string ===
def get_latest_name(names_str: str) -> str:
    """Extract the most recent name from JSON array"""
    if not names_str:
        return "Unknown#Unknown"
    
    try:
        names_list = json.loads(names_str)
        if isinstance(names_list, list) and names_list:
            return names_list[-1].strip() or "Unknown#Unknown"
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass
    
    return "Unknown#Unknown"

# === Enrich nodes with player stats (batch query) ===
def add_player_stats_to_graph(G: nx.Graph, db_path: str):
    """Efficiently fetch player data using batch query"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Batch query all nodes at once
    node_list = list(G.nodes())
    placeholders = ','.join('?' * len(node_list))
    query = f"SELECT puuid, names, feedscore, opscore, country FROM players WHERE puuid IN ({placeholders})"
    
    cursor.execute(query, node_list)
    
    # Create lookup dictionary
    player_data = {}
    for row in cursor.fetchall():
        puuid, names, feedscore, opscore, country = row
        player_data[puuid] = {
            'label_name': get_latest_name(names),
            'feedscore': feedscore,
            'opscore': opscore,
            'country': country
        }
    
    conn.close()
    
    # Apply data to graph
    for node in G.nodes():
        if node in player_data:
            nx.set_node_attributes(G, {node: player_data[node]})
        else:
            nx.set_node_attributes(G, {node: {
                'label_name': 'Unknown#Unknown',
                'feedscore': 'N/A',
                'opscore': 'N/A',
                'country': 'N/A'
            }})

# === Filter by edge weight ===
def filter_by_edge_weight(G: nx.Graph, min_weight: int) -> nx.Graph:
    """Create subgraph with only edges >= min_weight"""
    edges_to_keep = [(u, v) for u, v, d in G.edges(data=True) 
                     if d.get('weight', 1) >= min_weight]
    
    filtered = nx.Graph()
    filtered.add_edges_from(edges_to_keep)
    
    # Copy edge weights
    for u, v in edges_to_keep:
        filtered[u][v]['weight'] = G[u][v]['weight']
    
    # Copy node attributes
    for node in filtered.nodes():
        if node in G.nodes():
            filtered.nodes[node].update(G.nodes[node])
    
    return filtered

# === Louvain Community Detection ===
def detect_communities_louvain(G: nx.Graph, min_weight: int) -> Tuple[Dict, Dict]:
    """
    Use Louvain algorithm for community detection.
    Returns communities and highlights for best/worst players per community.
    """
    print("Running Louvain community detection...")
    
    # Filter graph by edge weight
    filtered_G = filter_by_edge_weight(G, min_weight)
    
    if len(filtered_G.nodes()) == 0:
        print("No nodes after filtering!")
        return {}, {'best_op': set(), 'worst_feed': set()}
    
    # Run Louvain algorithm
    communities = community.greedy_modularity_communities(filtered_G, weight='weight')
    
    print(f"Found {len(communities)} communities using Louvain algorithm")
    
    # Analyze each community
    cluster_data = []
    highlights = {
        'best_op': set(),
        'worst_feed': set()
    }
    
    for idx, comm in enumerate(communities):
        if len(comm) < 2:
            continue
        
        # Find best OP and worst feed in this community
        best_op_node = None
        worst_feed_node = None
        best_op_score = float('-inf')
        worst_feed_score = float('-inf')
        
        for node in comm:
            node_data = G.nodes.get(node, {})
            
            # Check OP score
            try:
                opscore = float(node_data.get('opscore', 0)) if node_data.get('opscore') != 'N/A' else 0
                if opscore > best_op_score:
                    best_op_score = opscore
                    best_op_node = node
            except (ValueError, TypeError):
                pass
            
            # Check feed score
            try:
                feedscore = float(node_data.get('feedscore', 0)) if node_data.get('feedscore') != 'N/A' else 0
                if feedscore > worst_feed_score:
                    worst_feed_score = feedscore
                    worst_feed_node = node
            except (ValueError, TypeError):
                pass
        
        if best_op_node:
            highlights['best_op'].add(best_op_node)
        if worst_feed_node:
            highlights['worst_feed'].add(worst_feed_node)
        
        cluster_data.append({
            "community_id": idx,
            "size": len(comm),
            "members": list(comm),
            "best_op": best_op_node,
            "worst_feed": worst_feed_node,
            "modularity_class": idx
        })
        
        print(f"Community {idx}: {len(comm)} members")
    
    # Save cluster data
    result_json = {
        "algorithm": "louvain",
        "num_communities": len(cluster_data),
        "clusters": cluster_data,
        "highlights": {
            "best_op": list(highlights['best_op']),
            "worst_feed": list(highlights['worst_feed'])
        }
    }
    
    os.makedirs('clusters', exist_ok=True)
    with open('clusters/clusters.json', 'w', encoding='utf-8') as f:
        json.dump(result_json, f, indent=2)
    
    print(f"Saved cluster data to clusters/clusters.json")
    
    return result_json, highlights

# === Visualize graph (optimized for browser performance) ===
def visualize_graph(G: nx.Graph, output_html: str, show_standalone: bool, min_edge_weight: int):
    """Generate optimized HTML visualization with reduced lag"""
    
    # Filter graph
    if not show_standalone:
        G_viz = filter_by_edge_weight(G, min_edge_weight)
        # Only keep nodes that have edges
        nodes_with_edges = set()
        for u, v in G_viz.edges():
            nodes_with_edges.add(u)
            nodes_with_edges.add(v)
        G_viz = G_viz.subgraph(nodes_with_edges).copy()
        print(f"Filtered graph: {len(G_viz.nodes())} connected nodes")
    else:
        G_viz = G
        print(f"Full graph: {len(G_viz.nodes())} nodes")
    
    # Detect communities
    _, highlights = detect_communities_louvain(G, min_edge_weight)
    
    def format_score(score):
        return f"{score:.2f}" if isinstance(score, (int, float)) else "N/A"
    
    # Prepare nodes and edges data with minimal data structure
    nodes_data = []
    edges_data = []
    
    # Add nodes with all labels
    for node, data in G_viz.nodes(data=True):
        feedscore = format_score(data.get('feedscore'))
        opscore = format_score(data.get('opscore'))
        label_name = data.get('label_name', 'Unknown#Unknown')
        country = data.get('country', 'N/A')
        
        # Create tooltip with full info (shown on hover)
        tooltip = f"{label_name}\nFeedscore: {feedscore}\nOPscore: {opscore}\nCountry: {country}"
        
        # NO LABEL - only show on hover
        display_label = ""
        
        # Determine styling
        if node in highlights['best_op'] and node in highlights['worst_feed']:
            color = "#FF6B35"
            size = 28
            border_color = "#FFD700"
            border_width = 3
        elif node in highlights['best_op']:
            color = "#00FF7F"
            size = 24
            border_color = "#00CC66"
            border_width = 3
        elif node in highlights['worst_feed']:
            color = "#FF4444"
            size = 24
            border_color = "#CC0000"
            border_width = 3
        else:
            color = "#666666"
            size = 10
            border_color = "#333333"
            border_width = 1
        
        nodes_data.append({
            'id': node,
            'label': display_label,  # Empty label
            'title': tooltip,  # Full info on hover
            'color': {'background': color, 'border': border_color},
            'size': size,
            'font': {'size': 14, 'color': '#ffffff'},
            'borderWidth': border_width
        })
    
    # Add edges
    for u, v, data in G_viz.edges(data=True):
        weight = data.get("weight", 1)
        if weight >= min_edge_weight:
            edges_data.append({
                'from': u,
                'to': v,
                'value': weight,
                'title': f"Matches: {weight}"
            })
    
    print(f"Prepared {len(nodes_data)} nodes and {len(edges_data)} edges")
    
    # Create optimized HTML with performance improvements
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Player Network Graph</title>
    <script type="text/javascript" src="https://unpkg.com/vis-network@9.1.2/standalone/umd/vis-network.min.js"></script>
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: #1a1a1a;
        }}
        #network {{
            width: 100%;
            height: 100vh;
            background: #222222;
        }}
        .controls {{
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 1000;
            background: rgba(0,0,0,0.85);
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-size: 13px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }}
        .controls h3 {{
            margin: 0 0 10px 0;
            font-size: 16px;
        }}
        .controls button {{
            margin: 5px 5px 5px 0;
            padding: 8px 12px;
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }}
        .controls button:hover {{
            background: #666;
        }}
        .controls button.active {{
            background: #007acc;
        }}
        .controls label {{
            margin-right: 10px;
            font-size: 12px;
        }}
        .controls input[type="checkbox"] {{
            margin-right: 5px;
        }}
        .controls input {{
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid #666;
            background: #333;
            color: white;
            width: 50px;
        }}
        .legend {{
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #444;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            margin: 5px 0;
            font-size: 11px;
        }}
        .legend-color {{
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 8px;
        }}
        .stats {{
            margin-top: 10px;
            font-size: 11px;
            color: #aaa;
        }}
    </style>
</head>
<body>
    <div class="controls">
        <h3>Player Network Graph</h3>
        <div>
            <button id="showAll" onclick="toggleMode('all')" class="active">Show All Nodes</button>
            <button id="showConnected" onclick="toggleMode('connected')">Connected Only</button>
        </div>
        <div style="margin-top: 10px;">
            Min Edge Weight: <input type="number" id="minWeight" value="{min_edge_weight}" min="1" max="10" onchange="updateMinWeight()">
        </div>
        <div style="margin-top: 10px;">
            <label><input type="checkbox" id="showLabels" onchange="toggleLabels()"> Show Names</label>
        </div>
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #00FF7F; border: 2px solid #00CC66;"></div>
                <span>⭐ Best OP Score</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FF4444; border: 2px solid #CC0000;"></div>
                <span>💀 Worst Feed Score</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FF6B35; border: 2px solid #FFD700;"></div>
                <span>⚡ Both (Controversial!)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #666666;"></div>
                <span>Regular Player</span>
            </div>
        </div>
        <div class="stats" id="stats">
            Nodes: {len(nodes_data)} | Edges: {len(edges_data)}
        </div>
    </div>
    
    <div id="network"></div>
    
    <script type="text/javascript">
        // Data
        const allNodes = {json.dumps(nodes_data)};
        const allEdges = {json.dumps(edges_data)};
        
        let currentMinWeight = {min_edge_weight};
        let currentMode = 'all';
        let showLabels = false;
        
        // Store full player data for label toggling
        const playerData = new Map();
        allNodes.forEach(node => {{
            playerData.set(node.id, {{
                name: node.title.split('\\n')[0],
                fullTooltip: node.title
            }});
        }});
        
        // Create datasets
        const nodes = new vis.DataSet(allNodes);
        const edges = new vis.DataSet(allEdges);
        
        // Network options optimized for performance
        const options = {{
            nodes: {{
                shape: 'dot',
                borderWidth: 2,
                borderWidthSelected: 3,
                chosen: {{
                    node: function(values, id, selected, hovering) {{
                        if (hovering) {{
                            values.size *= 1.2;
                        }}
                    }}
                }}
            }},
            edges: {{
                color: {{
                    color: '#555555',
                    highlight: '#888888',
                    hover: '#777777'
                }},
                smooth: {{
                    enabled: false  // Disable for better performance
                }},
                width: 1,
                scaling: {{
                    min: 1,
                    max: 5
                }}
            }},
            physics: {{
                enabled: true,
                stabilization: {{
                    enabled: true,
                    iterations: 100,
                    updateInterval: 25,
                    fit: true
                }},
                barnesHut: {{
                    gravitationalConstant: -15000,
                    centralGravity: 0.1,
                    springLength: 200,
                    springConstant: 0.02,
                    damping: 0.09,
                    avoidOverlap: 0.5
                }},
                maxVelocity: 50,
                minVelocity: 0.75,
                solver: 'barnesHut',
                timestep: 0.5
            }},
            interaction: {{
                dragNodes: true,
                dragView: true,
                zoomView: true,
                hover: true,
                tooltipDelay: 100,
                hideEdgesOnDrag: true,  // Better performance when dragging
                hideEdgesOnZoom: true   // Better performance when zooming
            }}
        }};
        
        // Initialize network
        const container = document.getElementById('network');
        const data = {{ nodes: nodes, edges: edges }};
        const network = new vis.Network(container, data, options);
        
        // Disable physics after stabilization for smoother interaction
        network.once('stabilizationIterationsDone', function() {{
            console.log('Stabilization complete');
            network.setOptions({{ physics: false }});
        }});
        
        function toggleMode(mode) {{
            currentMode = mode;
            updateVisualization();
            
            document.getElementById('showAll').classList.toggle('active', mode === 'all');
            document.getElementById('showConnected').classList.toggle('active', mode === 'connected');
        }}
        
        function updateMinWeight() {{
            currentMinWeight = parseInt(document.getElementById('minWeight').value);
            updateVisualization();
        }}
        
        function toggleLabels() {{
            showLabels = document.getElementById('showLabels').checked;
            
            // Update all nodes with or without labels
            const currentNodes = nodes.get();
            currentNodes.forEach(node => {{
                const data = playerData.get(node.id);
                if (data) {{
                    nodes.update({{
                        id: node.id,
                        label: showLabels ? data.name : ''
                    }});
                }}
            }});
        }}
        
        function updateVisualization() {{
            // Filter edges by weight
            const filteredEdges = allEdges.filter(edge => edge.value >= currentMinWeight);
            
            let nodesToShow;
            if (currentMode === 'connected') {{
                // Get nodes that have at least one edge
                const connectedNodeIds = new Set();
                filteredEdges.forEach(edge => {{
                    connectedNodeIds.add(edge.from);
                    connectedNodeIds.add(edge.to);
                }});
                nodesToShow = allNodes.filter(node => connectedNodeIds.has(node.id));
            }} else {{
                nodesToShow = allNodes;
            }}
            
            // Update visualization
            nodes.clear();
            edges.clear();
            nodes.add(nodesToShow);
            edges.add(filteredEdges);
            
            // Update stats
            document.getElementById('stats').textContent = 
                `Nodes: ${{nodesToShow.length}} | Edges: ${{filteredEdges.length}}`;
        }}
    </script>
</body>
</html>"""
    
    # Write to file
    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Visualization saved to {output_html}")

# === Main ===
def main():
    parser = argparse.ArgumentParser(
        description='Generate network visualization of player connections using Louvain clustering'
    )
    parser.add_argument('--connected-only', action='store_true',
                       help='Show only connected nodes (hide standalone nodes)')
    parser.add_argument('--min-weight', type=int, default=2,
                       help='Minimum edge weight to display (default: 2)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("PLAYER NETWORK GRAPH BUILDER (Louvain Clustering)")
    print("=" * 60)
    
    # Load matches
    print(f"\n[1/4] Loading matches from {MATCH_FOLDER}...")
    matches = load_matches_from_folder(MATCH_FOLDER)
    print(f"Loaded {len(matches)} matches")
    
    # Build graph
    print(f"\n[2/4] Building graph...")
    G = build_graph_from_matches(matches)
    print(f"Graph: {len(G.nodes())} nodes, {len(G.edges())} edges")
    
    # Add player stats
    print(f"\n[3/4] Enriching nodes with player data from {DB_PATH}...")
    add_player_stats_to_graph(G, DB_PATH)
    
    # Generate visualization
    print(f"\n[4/4] Generating visualization...")
    visualize_graph(
        G, 
        OUTPUT_HTML,
        show_standalone=not args.connected_only,
        min_edge_weight=args.min_weight
    )
    
    # Statistics
    total_nodes = len(G.nodes())
    filtered_G = filter_by_edge_weight(G, args.min_weight)
    connected_nodes = len([n for n in filtered_G.nodes() if filtered_G.degree(n) > 0])
    
    print("\n" + "=" * 60)
    print("STATISTICS")
    print("=" * 60)
    print(f"Total nodes: {total_nodes}")
    print(f"Connected nodes (edges >= {args.min_weight}): {connected_nodes}")
    print(f"Standalone nodes: {total_nodes - connected_nodes}")
    print(f"Total edges (all): {len(G.edges())}")
    print(f"Filtered edges (>= {args.min_weight}): {len(filtered_G.edges())}")
    print("=" * 60)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())