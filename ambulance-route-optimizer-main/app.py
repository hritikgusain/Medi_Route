from flask import Flask, render_template, jsonify, request, redirect, url_for
import json
import os
import copy
from urllib.parse import urlencode
from graph import load_hospitals, build_graph, dijkstra_with_path, distance_calculate
from haversine import haversine

# Load hospital data and build graph
nodes = load_hospitals(file_path=r"D:/Dhruv Verma -  4th Semester/Project/AmbulanceNavigator/Hospitals.json")
graph = build_graph(nodes)
original_graph = graph  # Create a copy for reference

app = Flask(__name__)


@app.route('/')
def front():
    return render_template('front.html')

@app.route('/index')
def index():
    return render_template('index.html')

@app.route('/hospitals')
def get_hospitals():
    try:
        with open(r"D:/Dhruv Verma -  4th Semester/Project/AmbulanceNavigator/Hospitals.json", 'r') as f:
            hospital_data = json.load(f)
        return jsonify(hospital_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/nearest')
def get_nearest_hospital():
    try:
        user_lat = request.args.get('lat', type=float)
        user_lon = request.args.get('lon', type=float)

        if user_lat is None or user_lon is None:
            return jsonify({'error': 'Invalid or missing lat/lon'}), 400

        user_coords = (user_lat, user_lon)
        temp_graph = copy.deepcopy(graph)
        temp_graph["User"] = {}

        for hospital, coords in nodes.items():
            dist = distance_calculate(user_coords, coords)
            temp_graph["User"][hospital] = round(dist, 2)
            temp_graph[hospital]["User"] = round(dist, 2)

        nearest = min(temp_graph["User"], key=temp_graph["User"].get)
        path, total_distance = dijkstra_with_path(temp_graph, "User", nearest)

        if "User" in path:
            path.remove("User")

        route_coords = [list(user_coords)] + [list(nodes[hop]) for hop in path]

        return jsonify({
            'nearest_hospital': nearest,
            'route': route_coords,
            'distance': total_distance
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/graph')
def get_graph():
    try:
        return jsonify(graph)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/shortest')
def get_shortest_paths():
    try:
        start = request.args.get('start')
        if start not in graph:
            return jsonify({'error': f"{start} not found in hospital graph"}), 404
        distances = dijkstra_with_path(graph, start)
        return jsonify(distances)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/route')
def get_route():
    try:
        start = request.args.get('start')
        end = request.args.get('end')

        if not start or not end:
            return jsonify({'error': 'Start and end hospitals required'}), 400
        if start not in graph or end not in graph:
            return jsonify({'error': 'Invalid hospital name'}), 404

        path, total_dist = dijkstra_with_path(graph, start, end)
        coords = [list(nodes[hop]) for hop in path]

        return jsonify({
            'route': coords,
            'distance': total_dist
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/find-route-from-coords', methods=['POST'])
def find_route_from_coords():
    try:
        data = request.get_json()
        start_coords = data.get('start')
        end_hospital = data.get('endHospital')

        if not start_coords or not end_hospital:
            return jsonify({'error': 'Start coordinates and end hospital required'}), 400

        temp_graph = copy.deepcopy(original_graph)
        temp_graph["User"] = {}

        for hospital, coords in nodes.items():
            dist = distance_calculate((start_coords['lat'], start_coords['lng']), coords)
            temp_graph["User"][hospital] = round(dist, 2)
            temp_graph[hospital]["User"] = round(dist, 2)

        path, total_dist = dijkstra_with_path(temp_graph, "User", end_hospital)

        if "User" in path:
            path.remove("User")

        route_coords = [[start_coords['lat'], start_coords['lng']]] + [list(nodes[hop]) for hop in path]

        return jsonify({
            'hospital': end_hospital,
            'route': route_coords,
            'path': path,
            'distance': round(total_dist, 2)
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/share-location-link')
def generate_location_link():
    """
    Use this route to generate a sharable link with lat/lon.
    Example: /share-location-link?lat=28.61&lon=77.21
    """
    user_lat = request.args.get('lat')
    user_lon = request.args.get('lon')

    if not user_lat or not user_lon:
        return jsonify({'error': 'Latitude and longitude are required'}), 400

    query = urlencode({'lat': user_lat, 'lon': user_lon})
    full_link = request.host_url + 'receive-location?' + query

    return jsonify({'link': full_link})

@app.route('/receive-location')
def receive_location():
    """
    Someone opens this link to get the nearest hospital for shared lat/lon.
    """
    try:
        user_lat = request.args.get('lat', type=float)
        user_lon = request.args.get('lon', type=float)

        if not user_lat or not user_lon:
            return "Invalid or missing coordinates", 400

     
        user_coords = (user_lat, user_lon)
        temp_graph = copy.deepcopy(graph)
        temp_graph["User"] = {}

        for hospital, coords in nodes.items():
            dist = distance_calculate(user_coords, coords)
            temp_graph["User"][hospital] = round(dist, 2)
            temp_graph[hospital]["User"] = round(dist, 2)

        nearest = min(temp_graph["User"], key=temp_graph["User"].get)
        path, total_distance = dijkstra_with_path(temp_graph, "User", nearest)

        if "User" in path:
            path.remove("User")

        route_coords = [list(user_coords)] + [list(nodes[hop]) for hop in path]

        return render_template('share_result.html', nearest=nearest, route=route_coords, distance=total_distance)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return f"Error: {str(e)}", 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

