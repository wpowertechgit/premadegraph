using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;

namespace TribalNeuroSim.Client.UI;

public enum DraggablePanelId
{
    DebugHud,
    Selection,
    Performance,
    Lineage,
    Tombstone,
}

public sealed class PanelDragController
{
    private static readonly DraggablePanelId[] HitTestOrder =
    [
        DraggablePanelId.Selection,
        DraggablePanelId.Performance,
        DraggablePanelId.Lineage,
        DraggablePanelId.Tombstone,
        DraggablePanelId.DebugHud,
    ];

    private readonly Dictionary<DraggablePanelId, Point> _customOrigins = new();
    private DraggablePanelId? _activePanel;
    private Point _dragOffset;

    public bool ConsumesPointer { get; private set; }

    public Point ResolveOrigin(DraggablePanelId panel, Point fallback)
    {
        return _customOrigins.TryGetValue(panel, out var origin) ? origin : fallback;
    }

    public void Update(
        MouseState mouse,
        MouseState previousMouse,
        Viewport viewport,
        IReadOnlyDictionary<DraggablePanelId, Rectangle> bounds)
    {
        ConsumesPointer = false;
        var mousePoint = new Point(mouse.X, mouse.Y);

        if (mouse.LeftButton == ButtonState.Pressed && previousMouse.LeftButton == ButtonState.Released)
        {
            foreach (var panel in HitTestOrder)
            {
                if (!bounds.TryGetValue(panel, out var rect) || rect.IsEmpty || !rect.Contains(mousePoint))
                    continue;

                _activePanel = panel;
                _dragOffset = new Point(mousePoint.X - rect.X, mousePoint.Y - rect.Y);
                ConsumesPointer = true;
                break;
            }
        }

        if (mouse.LeftButton == ButtonState.Pressed && _activePanel is { } activePanel)
        {
            if (bounds.TryGetValue(activePanel, out var rect) && !rect.IsEmpty)
            {
                var unclamped = new Point(mousePoint.X - _dragOffset.X, mousePoint.Y - _dragOffset.Y);
                _customOrigins[activePanel] = ClampOrigin(unclamped, rect.Size, viewport);
                ConsumesPointer = true;
            }
        }

        if (mouse.LeftButton == ButtonState.Released)
        {
            _activePanel = null;
        }
    }

    public static Point ClampOrigin(Point origin, Point panelSize, Viewport viewport)
    {
        const int margin = 4;
        var maxX = Math.Max(margin, viewport.Width - panelSize.X - margin);
        var maxY = Math.Max(margin, viewport.Height - panelSize.Y - margin);
        return new Point(
            Math.Clamp(origin.X, margin, maxX),
            Math.Clamp(origin.Y, margin, maxY));
    }
}
