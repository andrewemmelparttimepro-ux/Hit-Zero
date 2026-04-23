// HIT ZERO — Brand wordmark. Editorial italic Fraunces, the "0" fills with teal→pink.
const HZWordmark = ({ size = 32, stacked = false, tagline = false }) => {
  const s = { fontSize: size, lineHeight: stacked ? 0.82 : 0.9 };
  return (
    <div className="hz-nosel" style={{ display: 'inline-block' }}>
      <div className="hz-wordmark" style={s}>
        {stacked ? (
          <>
            <div>HIT</div>
            <div>ZER<span className="hz-zero">O</span></div>
          </>
        ) : (
          <span>HIT ZER<span className="hz-zero">O</span></span>
        )}
      </div>
      {tagline && (
        <div className="hz-eyebrow" style={{ marginTop: 6, color: 'rgba(255,255,255,0.45)' }}>
          by Magic City · Minot, ND
        </div>
      )}
    </div>
  );
};
window.HZWordmark = HZWordmark;
