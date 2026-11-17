package com.secondcurve.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CareerModelPlugin.class);
        super.onCreate(savedInstanceState);
        int backgroundColor = Color.rgb(251, 250, 248);
        getWindow().getDecorView().setBackgroundColor(backgroundColor);
        if (Build.VERSION.SDK_INT < 35) {
            getWindow().setStatusBarColor(backgroundColor);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getWindow().setNavigationBarColor(backgroundColor);
            }
        }
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightNavigationBars(true);
    }
}
