using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Input;

namespace TribalNeuroSim.Client.Input;

public sealed class KeyboardCommandController
{
    public PlayableCommandSet ReadCommands(
        KeyboardState keyboard,
        KeyboardState previousKeyboard,
        MouseState mouse,
        MouseState previousMouse)
    {
        var selectAtScreenPosition = MousePressedOnce(
            mouse.LeftButton,
            previousMouse.LeftButton);

        return new PlayableCommandSet(
            QuitRequested: KeyPressedOnce(keyboard, previousKeyboard, Keys.Escape),
            TogglePause: KeyPressedOnce(keyboard, previousKeyboard, Keys.Space),
            StepTick: AnyKeyPressedOnce(keyboard, previousKeyboard, Keys.N, Keys.OemPeriod),
            Reset: KeyPressedOnce(keyboard, previousKeyboard, Keys.R),
            SelectNext: KeyPressedOnce(keyboard, previousKeyboard, Keys.Tab),
            SpeedUp: AnyKeyPressedOnce(keyboard, previousKeyboard, Keys.OemPlus, Keys.Add),
            SlowDown: AnyKeyPressedOnce(keyboard, previousKeyboard, Keys.OemMinus, Keys.Subtract),
            ToggleIsolatedViewer: KeyPressedOnce(keyboard, previousKeyboard, Keys.F5),
            ToggleFullscreen: KeyPressedOnce(keyboard, previousKeyboard, Keys.F11),
            CaptureScreenshots: KeyPressedOnce(keyboard, previousKeyboard, Keys.F6),
            ToggleLineageInspector: KeyPressedOnce(keyboard, previousKeyboard, Keys.L),
            ToggleTombstonePanel: KeyPressedOnce(keyboard, previousKeyboard, Keys.K),
            TombstoneCycleSort: KeyPressedOnce(keyboard, previousKeyboard, Keys.N),
            TombstoneScrollUp: KeyPressedOnce(keyboard, previousKeyboard, Keys.OemOpenBrackets),
            TombstoneScrollDown: KeyPressedOnce(keyboard, previousKeyboard, Keys.OemCloseBrackets),
            ForceDispute: KeyPressedOnce(keyboard, previousKeyboard, Keys.F),
            TogglePostProcess: KeyPressedOnce(keyboard, previousKeyboard, Keys.P),
            SelectAtScreenPosition: selectAtScreenPosition,
            SelectionScreenPosition: selectAtScreenPosition ? new Vector2(mouse.X, mouse.Y) : null);
    }

    public bool KeyPressedOnce(
        KeyboardState keyboard,
        KeyboardState previousKeyboard,
        Keys key)
    {
        return keyboard.IsKeyDown(key) && !previousKeyboard.IsKeyDown(key);
    }

    public bool AnyKeyPressedOnce(
        KeyboardState keyboard,
        KeyboardState previousKeyboard,
        params Keys[] keys)
    {
        foreach (var key in keys)
        {
            if (KeyPressedOnce(keyboard, previousKeyboard, key))
            {
                return true;
            }
        }

        return false;
    }

    public bool MousePressedOnce(
        ButtonState button,
        ButtonState previousButton)
    {
        return button == ButtonState.Pressed && previousButton == ButtonState.Released;
    }
}

public sealed record PlayableCommandSet(
    bool QuitRequested,
    bool TogglePause,
    bool StepTick,
    bool Reset,
    bool SelectNext,
    bool SpeedUp,
    bool SlowDown,
    bool ToggleIsolatedViewer,
    bool ToggleFullscreen,
    bool CaptureScreenshots,
    bool ToggleLineageInspector,
    bool ToggleTombstonePanel,
    bool TombstoneCycleSort,
    bool TombstoneScrollUp,
    bool TombstoneScrollDown,
    bool ForceDispute,
    bool TogglePostProcess,
    bool SelectAtScreenPosition,
    Vector2? SelectionScreenPosition);
