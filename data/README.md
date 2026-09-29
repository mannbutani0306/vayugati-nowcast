# Local Archived Data

The backend reads the local `DATA_DIR` tree only; archived products are not fetched at runtime. The public Data Lab exposes selected archived frames and source metadata without requiring sign-in. HDF5 and TIF files are tracked with Git LFS; the monthly CSV is a regular Git file.

| Folder | Contents |
|---|---|
| `imerg_halfhourly/leh_2010_08_05/` | GPM IMERG V07 half-hourly files for 2010-08-05 00:00 through 2010-08-06 06:00 UTC |
| `imerg_halfhourly/leh_2011_07_25/` | GPM IMERG V07 half-hourly files for 2011-07-25 00:00 through 18:00 UTC |
| `imerg_monthly/monthly_mean.csv` | Giovanni monthly-mean precipitation-rate export and its original header lines |
| `mosdac/` | Local INSAT-3DR TIR1 GeoTIFF scenes and matching calibration products, if provided |

Keep the downloaded source files and their metadata together. Check the applicable NASA/GES DISC and MOSDAC terms for the exact product and account before redistribution; access or download availability does not imply permission to redistribute. The backend image copies this tree to `/app/data`, while Docker Compose mounts the local tree read-only for development. Ensure Git LFS has materialized file contents before building the image; LFS pointer text is not usable data.

When a data source requires credentials, users should obtain the data through its authorized portal and copy the files into the matching local folder. The application reports `AWAITING REAL DATA` when required files are absent or cannot be interpreted safely.