import json
import math

# calculating distance between two coordinates 
def distance_calculate(coord1, coord2):
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371  # Earth radius in km

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

# loading hospital data from JSON
def load_hospitals(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    hospitals = {}
    for entry in data:
        name = entry["Hospital Name"]
        lat = entry["Latitude"]
        lon = entry["Longitude"]
        hospitals[name] = (lat, lon)
    return hospitals


# Building graph with distances between all hospitals
def build_graph(nodes):
    graph = {}
    for name1, coord1 in nodes.items():
        graph[name1] = {}
        for name2, coord2 in nodes.items():
            if name1 != name2:
                distance = distance_calculate(coord1, coord2)
                graph[name1][name2] = round(distance, 2)
    return graph

import heapq

def dijkstra_with_path(graph, start, end):
    distances = {node: float('inf') for node in graph}
    previous = {node: None for node in graph}
    distances[start] = 0
    queue = [(0, start)]

    while queue:
        current_dist, current_node = heapq.heappop(queue)

        if current_node == end:
            break

        for neighbor, weight in graph[current_node].items():
            distance = current_dist + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous[neighbor] = current_node
                heapq.heappush(queue, (distance, neighbor))

    # Reconstruct path
    path = []
    current = end
    while current is not None:
        path.append(current)
        current = previous[current]
    path.reverse()

    return path, round(distances[end], 2)
