"""
StreetEasy Finder - Web Configuration UI

A Flask web app that lets users configure the apartment tracker:
- Set email credentials and recipients
- Choose neighborhoods, price range, bedroom count
- Preview the dynamically built StreetEasy URL
- Monitor Docker container connectivity
"""

import os
import subprocess
import json
from flask import Flask, render_template, jsonify, request
from dotenv import dotenv_values

app = Flask(__name__)

# StreetEasy neighborhood data: (display name, URL slug, area code for multi-select)
NEIGHBORHOODS = {
    "All NYC": [
        {"name": "All of NYC", "slug": "nyc", "code": None},
    ],
    "Manhattan": [
        {"name": "All Manhattan", "slug": "manhattan", "code": None},
        {"name": "Upper West Side", "slug": "upper-west-side", "code": 302},
        {"name": "Upper East Side", "slug": "upper-east-side", "code": 301},
        {"name": "Midtown", "slug": "midtown", "code": 109},
        {"name": "Chelsea", "slug": "chelsea", "code": 106},
        {"name": "Hell's Kitchen", "slug": "hells-kitchen", "code": 107},
        {"name": "Gramercy / Murray Hill", "slug": "gramercy", "code": 111},
        {"name": "East Village", "slug": "east-village", "code": 112},
        {"name": "West Village", "slug": "west-village", "code": 113},
        {"name": "Lower East Side", "slug": "lower-east-side", "code": 114},
        {"name": "SoHo", "slug": "soho", "code": 115},
        {"name": "Tribeca", "slug": "tribeca", "code": 116},
        {"name": "Financial District", "slug": "financial-district", "code": 117},
        {"name": "Harlem", "slug": "harlem", "code": 118},
        {"name": "Washington Heights", "slug": "washington-heights", "code": 119},
    ],
    "Brooklyn": [
        {"name": "All Brooklyn", "slug": "brooklyn", "code": None},
        {"name": "Brooklyn Heights", "slug": "brooklyn-heights", "code": 203},
        {"name": "Williamsburg", "slug": "williamsburg", "code": 204},
        {"name": "Park Slope", "slug": "park-slope", "code": 206},
        {"name": "Bushwick", "slug": "bushwick", "code": 207},
        {"name": "DUMBO", "slug": "dumbo", "code": 208},
        {"name": "Crown Heights", "slug": "crown-heights", "code": 209},
        {"name": "Bed-Stuy", "slug": "bedford-stuyvesant", "code": 210},
        {"name": "Carroll Gardens", "slug": "carroll-gardens", "code": 212},
        {"name": "Cobble Hill", "slug": "cobble-hill", "code": 213},
        {"name": "Fort Greene", "slug": "fort-greene", "code": 214},
        {"name": "Sunset Park", "slug": "sunset-park", "code": 216},
        {"name": "Bay Ridge", "slug": "bay-ridge", "code": 217},
    ],
    "Queens": [
        {"name": "All Queens", "slug": "queens", "code": None},
        {"name": "Long Island City", "slug": "long-island-city", "code": 411},
        {"name": "Astoria", "slug": "astoria", "code": 412},
        {"name": "Jackson Heights", "slug": "jackson-heights", "code": 413},
        {"name": "Flushing", "slug": "flushing", "code": 414},
        {"name": "Forest Hills", "slug": "forest-hills", "code": 415},
        {"name": "Sunnyside", "slug": "sunnyside", "code": 416},
    ],
    "Bronx": [
        {"name": "All Bronx", "slug": "bronx", "code": None},
        {"name": "Riverdale", "slug": "riverdale", "code": 501},
        {"name": "Fordham", "slug": "fordham", "code": 502},
    ],
}


def load_config():
    """Load current config from .env file."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        return dotenv_values(env_path)
    return {}


def build_streeteasy_url(params):
    """
    Dynamically build a StreetEasy search URL from filter parameters.

    URL format: https://streeteasy.com/for-rent/{location}/{filter1}|{filter2}
    Price filter:  price:-3000  (under $3000)
                   price:2000-3000  (range)
                   price:2000-  (over $2000)
    Beds filter:   beds:1  (exactly 1)  |  beds%3C=2  (up to 2, i.e. <=2)
    """
    location = params.get('location', 'nyc').strip() or 'nyc'
    filters = []

    # Price range
    min_price = params.get('min_price', '').strip().replace(',', '').replace('$', '')
    max_price = params.get('max_price', '').strip().replace(',', '').replace('$', '')

    if min_price and max_price:
        filters.append(f"price:{min_price}-{max_price}")
    elif max_price:
        filters.append(f"price:-{max_price}")
    elif min_price:
        filters.append(f"price:{min_price}-")

    # Bedrooms
    beds = params.get('beds', 'any').strip()
    if beds and beds != 'any':
        if beds == '0':
            filters.append('beds:0')           # Studio
        elif beds.startswith('lte_'):
            n = beds.replace('lte_', '')
            filters.append(f"beds%3C={n}")     # Up to N beds (URL-encoded <=)
        else:
            filters.append(f"beds:{beds}")     # Exact count

    base_url = f"https://streeteasy.com/for-rent/{location}"
    if filters:
        base_url += '/' + '|'.join(filters)

    return base_url


@app.route('/')
def index():
    config = load_config()
    return render_template('index.html', config=config, neighborhoods=NEIGHBORHOODS)


@app.route('/api/docker-status')
def docker_status():
    """Check if the apartment-tracker Docker container is running."""
    try:
        result = subprocess.run(
            ['docker', 'ps', '--filter', 'name=apartment-tracker',
             '--format', '{{.Names}}\t{{.Status}}'],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout.strip()
        if result.returncode == 0 and output and 'apartment-tracker' in output:
            # Parse status (e.g. "Up 2 hours")
            parts = output.split('\t')
            status_text = parts[1] if len(parts) > 1 else 'Up'
            return jsonify({'status': 'running', 'details': status_text})
        else:
            return jsonify({'status': 'stopped', 'details': 'Container not found or not running'})
    except FileNotFoundError:
        return jsonify({'status': 'unavailable', 'details': 'Docker not found on this host'})
    except subprocess.TimeoutExpired:
        return jsonify({'status': 'error', 'details': 'Docker status check timed out'})
    except Exception as e:
        return jsonify({'status': 'error', 'details': str(e)})


@app.route('/api/build-url', methods=['POST'])
def api_build_url():
    """Return the dynamically built StreetEasy URL for a given set of filters."""
    data = request.get_json(force=True)
    url = build_streeteasy_url(data)
    return jsonify({'url': url})


@app.route('/api/save-config', methods=['POST'])
def save_config():
    """Persist user configuration to the .env file."""
    data = request.get_json(force=True)
    se_url = build_streeteasy_url(data)

    email_address = data.get('email_address', '').strip()
    email_password = data.get('email_password', '').strip()
    to_email = data.get('to_email', '').strip() or email_address
    time_interval = data.get('time_interval', '5').strip() or '5'

    env_lines = [
        '# StreetEasy Apartment Tracker - Auto-generated config',
        f'SE_URL={se_url}',
        '',
        '# Email configuration',
        f'EMAIL_ADDRESS={email_address}',
        f'EMAIL_PASSWORD={email_password}',
        f'TO_EMAIL={to_email}',
        '',
        '# Scheduler interval in minutes',
        f'TIME_INTERVAL={time_interval}',
        '',
        '# Database path',
        'DB_PATH=/app/data/apartments.db',
    ]

    env_path = os.path.join(os.path.dirname(__file__), '.env')
    with open(env_path, 'w') as f:
        f.write('\n'.join(env_lines) + '\n')

    return jsonify({'success': True, 'url': se_url})


@app.route('/api/get-config')
def get_config():
    """Return current config (without password) for pre-populating the form."""
    config = load_config()
    # Never expose the password over the API
    safe_config = {k: v for k, v in config.items() if k != 'EMAIL_PASSWORD'}
    return jsonify(safe_config)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
