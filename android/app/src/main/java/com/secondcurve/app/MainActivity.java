package com.secondcurve.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CareerModelPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
