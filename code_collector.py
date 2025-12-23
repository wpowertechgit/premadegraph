import os

# A kimeneti fájl neve
OUTPUT_FILE = "teljes_projekt_kod.txt"

# Csak ezeket a kiterjesztéseket veszi figyelembe (Whitelist)
ALLOWED_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.sql', '.css', '.md', '.txt'}

# Ezeket mindenképp KIZÁRJA (Blacklist - biztonsági háló)
IGNORED_EXTENSIONS = {'.json', '.log', '.html', '.pyc','.txt','.css'}

# Milyen mappákat HAGYJON KI a keresésből?
EXCLUDE_DIRS = {
    'node_modules', '.git', '__pycache__', 'venv', 'env', 
    'build', 'dist', 'coverage', '.idea', '.vscode', 
    'clusters', 'data' # Feltételezem, itt vannak az adatmentések
}

# A script saját magát és a kimeneti fájlt is kihagyja
EXCLUDE_FILES = {'package-lock.json', 'yarn.lock', OUTPUT_FILE, os.path.basename(__file__)}

def collect_code():
    print("Kódok összegyűjtése folyamatban...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        # Végigsétál a mappákon
        for root, dirs, files in os.walk("."):
            # Helyben módosítjuk a dirs listát, hogy a tiltott mappákba be se lépjen
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                file_ext = os.path.splitext(file)[1].lower()
                
                # Csak akkor dolgozza fel, ha engedélyezett ÉS nem tiltott
                if file_ext in ALLOWED_EXTENSIONS and file_ext not in IGNORED_EXTENSIONS and file not in EXCLUDE_FILES:
                    file_path = os.path.join(root, file)
                    
                    # Útvonal normalizálása (hogy szép "backend/file.py" formátum legyen)
                    relative_path = os.path.relpath(file_path, ".")
                    clean_path = relative_path.replace("\\", "/") # Windows path fix
                    if clean_path.startswith("./"):
                        clean_path = clean_path[2:]
                    
                    try:
                        # Beolvassuk a fájlt
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                            
                        # A kért fejléc formátum
                        header = f"\n### {clean_path} #####\n"
                        
                        outfile.write(header)
                        outfile.write(content)
                        outfile.write("\n") # Kis elválasztás
                        
                        print(f"Hozzáadva: {clean_path}")
                        
                    except Exception as e:
                        print(f"Skipping (read error): {clean_path} - {e}")

    print(f"\nKész! A fájl létrehozva: {OUTPUT_FILE}")

if __name__ == "__main__":
    collect_code()