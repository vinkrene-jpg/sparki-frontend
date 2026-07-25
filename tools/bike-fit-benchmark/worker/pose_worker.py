#!/usr/bin/env python3
"""BF_00R pose worker — isolated benchmark prototype (NOT production).

Input : --frames-dir <dir with frame_%06d.png> --timestamps <json list of ms>
        --model <path to .task> [--min-confidence 0.5]
Output: JSON on stdout: {model_sha256, model_file, mediapipe_version, frames:[{i, ts_ms, landmarks:[{name,x,y,z,visibility,presence}]|null}]}
Privacy rule: NEVER print frame pixels or landmark values to stderr/logs; stderr carries only error class + message without payload data.
Exit codes: 0 ok, 2 input error, 3 model error, 4 inference error.
"""
import argparse, hashlib, json, os, sys

LANDMARK_NAMES = [
    "nose","left_eye_inner","left_eye","left_eye_outer","right_eye_inner","right_eye","right_eye_outer",
    "left_ear","right_ear","mouth_left","mouth_right",
    "left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist",
    "left_pinky","right_pinky","left_index","right_index","left_thumb","right_thumb",
    "left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle",
    "left_heel","right_heel","left_foot_index","right_foot_index",
]

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames-dir", required=True)
    ap.add_argument("--timestamps", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--min-confidence", type=float, default=0.5)
    args = ap.parse_args()

    try:
        with open(args.timestamps) as f:
            ts_ms = json.load(f)
        frame_files = sorted(
            f for f in os.listdir(args.frames_dir) if f.startswith("frame_") and f.endswith(".png")
        )
        if len(frame_files) != len(ts_ms):
            print(f"input_error: frame count {len(frame_files)} != timestamp count {len(ts_ms)}", file=sys.stderr)
            return 2
    except Exception as e:  # noqa: BLE001
        print(f"input_error: {type(e).__name__}", file=sys.stderr)
        return 2

    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        with open(args.model, "rb") as f:
            model_sha = hashlib.sha256(f.read()).hexdigest()

        options = vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=args.model),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=args.min_confidence,
            min_pose_presence_confidence=args.min_confidence,
            min_tracking_confidence=args.min_confidence,
        )
        landmarker = vision.PoseLandmarker.create_from_options(options)
    except Exception as e:  # noqa: BLE001
        print(f"model_error: {type(e).__name__}", file=sys.stderr)
        return 3

    frames_out = []
    try:
        for i, (fname, ts) in enumerate(zip(frame_files, ts_ms)):
            image = mp.Image.create_from_file(os.path.join(args.frames_dir, fname))
            result = landmarker.detect_for_video(image, int(ts))
            if result.pose_landmarks:
                lms = result.pose_landmarks[0]
                frames_out.append({
                    "i": i,
                    "ts_ms": ts,
                    "landmarks": [
                        {
                            "name": LANDMARK_NAMES[j],
                            "x": round(lm.x, 6),
                            "y": round(lm.y, 6),
                            "z": round(lm.z, 6),
                            "visibility": round(lm.visibility, 4),
                            "presence": round(lm.presence, 4),
                        }
                        for j, lm in enumerate(lms)
                    ],
                })
            else:
                frames_out.append({"i": i, "ts_ms": ts, "landmarks": None})
    except Exception as e:  # noqa: BLE001
        print(f"inference_error: {type(e).__name__}", file=sys.stderr)
        return 4
    finally:
        landmarker.close()

    json.dump(
        {
            "model_file": os.path.basename(args.model),
            "model_sha256": model_sha,
            "mediapipe_version": mp.__version__,
            "frame_count": len(frames_out),
            "frames": frames_out,
        },
        sys.stdout,
    )
    return 0

if __name__ == "__main__":
    sys.exit(main())
