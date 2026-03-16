import json
import sqlite3
from datetime import datetime, timezone
from typing import Iterable, Mapping, Sequence


def ensure_cluster_schema(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS clusters (
            cluster_id TEXT PRIMARY KEY,
            cluster_type TEXT NOT NULL,
            algorithm TEXT,
            size INTEGER NOT NULL,
            best_op TEXT,
            worst_feed TEXT,
            summary_json TEXT,
            center_x REAL,
            center_y REAL,
            build_version TEXT,
            updated_at TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL,
            puuid TEXT NOT NULL,
            is_bridge INTEGER NOT NULL DEFAULT 0,
            is_star INTEGER NOT NULL DEFAULT 0,
            is_best_op INTEGER NOT NULL DEFAULT 0,
            is_worst_feed INTEGER NOT NULL DEFAULT 0,
            role_json TEXT,
            PRIMARY KEY (cluster_id, puuid)
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_clusters_type ON clusters (cluster_type)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_cluster_members_puuid ON cluster_members (puuid)"
    )
    conn.commit()
    conn.close()


def replace_clusters(
    db_path: str,
    cluster_type: str,
    algorithm: str,
    clusters: Sequence[Mapping],
    build_version: str,
) -> None:
    ensure_cluster_schema(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    timestamp = datetime.now(timezone.utc).isoformat()

    existing_ids = [
        row[0]
        for row in cursor.execute(
            "SELECT cluster_id FROM clusters WHERE cluster_type = ?",
            (cluster_type,),
        ).fetchall()
    ]

    if existing_ids:
        placeholders = ",".join("?" for _ in existing_ids)
        cursor.execute(
            f"DELETE FROM cluster_members WHERE cluster_id IN ({placeholders})",
            existing_ids,
        )
        cursor.execute(
            "DELETE FROM clusters WHERE cluster_type = ?",
            (cluster_type,),
        )

    for index, cluster in enumerate(clusters, start=1):
        members = list(cluster.get("members", []))
        cluster_id = cluster.get("cluster_id") or f"{cluster_type}:{index}"
        best_op = cluster.get("best_op")
        worst_feed = cluster.get("worst_feed")
        center = cluster.get("center") or {}
        roles_by_member = cluster.get("rolesByMember") or {}

        summary_payload = {
            key: value
            for key, value in cluster.items()
            if key not in {"members", "center", "rolesByMember"}
        }

        cursor.execute(
            """
            INSERT INTO clusters (
                cluster_id,
                cluster_type,
                algorithm,
                size,
                best_op,
                worst_feed,
                summary_json,
                center_x,
                center_y,
                build_version,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cluster_id,
                cluster_type,
                algorithm,
                len(members),
                best_op,
                worst_feed,
                json.dumps(summary_payload, ensure_ascii=False),
                center.get("x"),
                center.get("y"),
                build_version,
                timestamp,
            ),
        )

        for member in members:
            role_info = roles_by_member.get(member) or {}
            cursor.execute(
                """
                INSERT INTO cluster_members (
                    cluster_id,
                    puuid,
                    is_bridge,
                    is_star,
                    is_best_op,
                    is_worst_feed,
                    role_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cluster_id,
                    member,
                    int(bool(role_info.get("is_bridge", False))),
                    int(bool(role_info.get("is_star", False))),
                    int(member == best_op),
                    int(member == worst_feed),
                    json.dumps(role_info, ensure_ascii=False) if role_info else None,
                ),
            )

    conn.commit()
    conn.close()
