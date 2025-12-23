import requests
import json
import time
import os
import sqlite3
import re
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-3-flash-preview"
HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "X-Title": "lol-cluster-country-detector"
}

def load_clusters_with_names(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["clusters"]

def batch_clusters(clusters, batch_size):
    for i in range(0, len(clusters), batch_size):
        yield clusters[i:i + batch_size]

def build_prompt_for_clusters(cluster_batch):
    prompt_lines = [
            "ACT AS an expert linguist and League of Legends EUNE region specialist.",
            "GOAL: Identify the country of origin for player clusters based on their usernames.",
            "",
            "RULES:",
            "1. For each cluster, you MUST provide a country name. 'Unknown', 'Undefined', or 'N/A' is STRICTLY FORBIDDEN.",
            "2. Use linguistic clues (e.g., 'PL' = Poland, 'RO' = Romania, 'CZ' = Czech Republic, 'GR/EL' = Greece).",
            "3. If names are generic (English), look for subtle cultural patterns or make your BEST EDUCATED GUESS based on EUNE demographics.",
            "4. Focus on these countries: Poland, Romania, Greece, Hungary, Czech Republic, Serbia, Bulgaria, Sweden, Norway, Denmark, Finland, Israel, Egypt.",
            "5. EXCLUDE: Turkey, Russia, and Western Europe (Germany, France, Spain, etc.) as they have separate servers.",
            "",
            "OUTPUT FORMAT:",
            "Return ONLY a raw JSON object. No explanation, no markdown formatting.",
            'Example: {"cluster1": "Poland", "cluster2": "Romania"}',
            "",
            "DATA TO ANALYZE:"
        ]
    
    for idx, cluster in enumerate(cluster_batch, start=1):
        cluster_id = f"cluster{idx}"
        names_str = ", ".join(cluster.get("names", []))
        prompt_lines.append(f"{cluster_id}: {names_str}")

    return "\n".join(prompt_lines)

def call_openrouter_api(prompt):
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=HEADERS,
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"API call failed: {e}")
        return None

def parse_ai_response(response_content):
    try:
        match = re.search(r"\{\s*\"cluster\d+\".*?\}", response_content, re.DOTALL)
        if not match:
            print("No valid JSON block found in AI response.")
            return None
        json_str = match.group(0)
        return json.loads(json_str)
    except Exception as e:
        print(f"Failed to parse AI response JSON: {e}")
        return None

def update_countries_in_db(db_path, clusters_batch, cluster_country_map):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    for idx, cluster in enumerate(clusters_batch, start=1):
        cluster_id = f"cluster{idx}"
        country = cluster_country_map.get(cluster_id)
        if not country:
            print(f"No country found for {cluster_id}, skipping DB update")
            continue
        
        for puuid in cluster.get("members", []):
            cursor.execute("UPDATE players SET country = ? WHERE puuid = ?", (country, puuid))
    
    conn.commit()
    conn.close()

def main():
    clusters = load_clusters_with_names("clusters/clusters_with_names.json")
    batch_size = 3
    
    for cluster_batch in batch_clusters(clusters, batch_size):
        prompt = build_prompt_for_clusters(cluster_batch)
        print("Sending prompt:\n", prompt)
        
        response_json = call_openrouter_api(prompt)
        if response_json is None:
            print("Skipping this batch due to API error.")
            continue
        
        ai_content = response_json["choices"][0]["message"]["content"]
        
        # Log AI response for debugging
        with open("ai_responses.log", "a", encoding="utf-8") as log_file:
            log_file.write("Prompt:\n" + prompt + "\n")
            log_file.write("Response:\n" + ai_content + "\n\n")
        
        cluster_country_map = parse_ai_response(ai_content)
        if cluster_country_map is None:
            print("Skipping this batch due to parsing error.")
            continue
        
        update_countries_in_db(DB_PATH, cluster_batch, cluster_country_map)
        print(f"Updated DB for batch with {len(cluster_batch)} clusters.")
        
        time.sleep(5)  # to avoid rate limits or spamming the API

if __name__ == "__main__":
    main()
